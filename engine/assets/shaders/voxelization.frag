# version 430

in GeometryOut
{
    vec4 wsPosition;
    vec3 position;
    vec3 normal;
    vec3 texCoord;
    flat int selectedAxis;
    flat vec4 triangleAABB;
} In;

layout (location = 0) out vec4 fragColor;
layout (pixel_center_integer) in vec4 gl_FragCoord;

layout(r32ui) uniform coherent volatile uimage3D voxelAlbedo;

uniform struct Material
{
    vec3 diffuse;
    vec3 specular;
    float shininess;
} material;

const uint MAX_DIRECTIONAL_LIGHTS = 8;
const uint MAX_POINT_LIGHTS = 256;
const uint MAX_SPOT_LIGHTS = 256;

struct Attenuation
{
    float constant;
    float linear;
    float quadratic;
};

struct Light {
    float angleInnerCone;
    float angleOuterCone;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    vec3 position;
    vec3 direction;

    Attenuation attenuation;
};

uniform sampler2D diffuseMap;
uniform sampler2D specularMap;
uniform sampler2D shadowMap;

uniform mat4 lightViewProjection;
uniform Light directionalLight[MAX_DIRECTIONAL_LIGHTS];
uniform Light pointLight[MAX_POINT_LIGHTS];
uniform Light spotLight[MAX_SPOT_LIGHTS];

uniform uint lightTypeCount[3];

uniform uint volumeDimension;

float Visibility(vec3 position)
{
    vec4 lsPos = lightViewProjection * vec4(position, 1.0f);
    // transform to ndc-space
    lsPos /= lsPos.w;
    // move bias z to avoid acne
    lsPos.z -= 0.005f;
    // querry visibility
    float sDepth = texture(shadowMap, lsPos.xy).x;

    if(sDepth < lsPos.z)
        return 0.0;
    else 
        return 1.0f;
}

vec4 convRGBA8ToVec4(uint val)
{
    return vec4(float((val & 0x000000FF)), 
    float((val & 0x0000FF00) >> 8U), 
    float((val & 0x00FF0000) >> 16U), 
    float((val & 0xFF000000) >> 24U));
}

uint convVec4ToRGBA8(vec4 val)
{
    return (uint(val.w) & 0x000000FF) << 24U | 
    (uint(val.z) & 0x000000FF) << 16U | 
    (uint(val.y) & 0x000000FF) << 8U | 
    (uint(val.x) & 0x000000FF);
}

void imageAtomicRGBA8Avg(layout(r32ui) coherent volatile uimage3D grid, ivec3 coords, vec4 value)
{
    value.rgb *= 255.0;                 // optimize following calculations
    uint newVal = convVec4ToRGBA8(value);
    uint prevStoredVal = 0;
    uint curStoredVal;

    while((curStoredVal = imageAtomicCompSwap(grid, coords, prevStoredVal, newVal)) != prevStoredVal)
    {
        prevStoredVal = curStoredVal;
        vec4 rval = convRGBA8ToVec4(curStoredVal);
        rval.rgb = (rval.rgb * rval.a); // Denormalize
        vec4 curValF = rval + value;    // Add
        curValF.rgb /= curValF.a;       // Renormalize
        newVal = convVec4ToRGBA8(curValF);
    }
}

vec3 Ambient(Light light, vec3 albedo)
{
    return albedo * light.ambient;
}

vec3 Diffuse(Light light, vec3 lightDirection, vec3 normal, vec3 albedo)
{
    float lambertian = max(dot(normal, lightDirection), 0.0f);
    return light.diffuse * albedo * lambertian;
}

vec3 Specular(Light light, vec3 lightDirection, vec3 normal, vec3 position, vec4 specular)
{
    vec3 halfDirection = normalize(lightDirection + normalize(-position));
    float specularFactor = max(dot(halfDirection, normal), 0.0f);
    specularFactor = pow(specularFactor, specular.a * 128.0f);

    return light.specular * specular.rgb * specularFactor;
}

vec3 CalculateDirectional(Light light, vec3 normal, vec3 position, vec3 albedo, vec4 specular)
{
    return Ambient(light, albedo) 
           + (Diffuse(light, light.direction, normal, albedo) 
           + Specular(light, light.direction, normal, position, specular)) 
           * Visibility(position);
}

vec3 CalculatePoint(Light light, vec3 normal, vec3 position, vec3 albedo, vec4 specular)
{
    light.direction = normalize(light.position - position);
    float distance = distance(light.position, position);
    float falloff = 1.0f / (light.attenuation.constant + light.attenuation.linear * distance
                    + light.attenuation.quadratic * distance * distance + 1.0f);

    if(falloff <= 0.0f) { return Ambient(light, albedo); }             

    return Ambient(light, albedo) 
           + (Diffuse(light, light.direction, normal, albedo) 
           + Specular(light, light.direction, normal, position, specular)) * falloff;
}

vec3 CalculateSpot(Light light, vec3 normal, vec3 position, vec3 albedo, vec4 specular)
{
    vec3 spotDirection = light.direction;
    light.direction = normalize(light.position - position);
    float cosAngle = dot(-light.direction, spotDirection);

    if(cosAngle <= light.angleOuterCone) { return Ambient(light, albedo); }

    // assuming they are passed as cos(angle)
    float innerMinusOuter = light.angleInnerCone - light.angleOuterCone;
    // spot light factor for smooth transition
    float spotMark = (cosAngle - light.angleOuterCone) / innerMinusOuter;
    float spotFalloff = smoothstep(0.0f, 1.0f, spotMark);

    float dst = distance(light.position, position);
    float falloff = 1.0f / (light.attenuation.constant + light.attenuation.linear * dst
                    + light.attenuation.quadratic * dst * dst + 1.0f);

    if(falloff <= 0.0f) { return Ambient(light, albedo); }             

    return Ambient(light, albedo) 
           + (Diffuse(light, light.direction, normal, albedo) 
           + Specular(light, light.direction, normal, position, specular)) 
           * falloff * spotFalloff;
}

vec4 CalculateRadiance()
{
    vec4 albedo = texture(diffuseMap, In.texCoord.xy);
    vec4 specular = texture(specularMap, In.texCoord.xy);
    vec3 position = In.wsPosition.xyz;
    vec3 normal = normalize(In.normal);
    // material color and pre-multiply alpha
    vec3 albedo3 = albedo.rgb * material.diffuse;
    specular.rgb *= material.specular;
    specular.a = material.shininess;

    // similar to light_pass.frag but no ambient light.

    vec3 radiance = vec3(0.0f);
    // calculate radiance for directional lights
    for(int i = 0; i < lightTypeCount[0]; ++i)
    {
        radiance += CalculateDirectional(directionalLight[i], normal, position, 
                                         albedo3, specular);
        radiance *= Visibility(position);
    }

    // calculate radiance for point lights
    for(int i = 0; i < lightTypeCount[1]; ++i)
    {
        radiance += CalculatePoint(pointLight[i], normal, position, 
                                   albedo3, specular);
    }

    // calculate radiance for spot lights
    for(int i = 0; i < lightTypeCount[2]; ++i) 
    {
        radiance += CalculateSpot(spotLight[i], normal, position, 
                                  albedo3, specular);
    }

    return clamp(vec4(radiance * albedo.a, albedo.a), vec4(0.0f), vec4(1.0f));
}

void main()
{
    if( In.position.x < In.triangleAABB.x || In.position.y < In.triangleAABB.y || 
		In.position.x > In.triangleAABB.z || In.position.y > In.triangleAABB.w )
	{
		discard;
	}

	uvec3 temp = uvec3( gl_FragCoord.x, gl_FragCoord.y, volumeDimension * gl_FragCoord.z ) ;
	uvec3 texcoord;

	if( In.selectedAxis == 0 )
	{
	    texcoord.x = volumeDimension - temp.z;
		texcoord.z = temp.x;
		texcoord.y = temp.y;
	}
	else if( In.selectedAxis == 1 )
    {
	    texcoord.z = temp.y;
		texcoord.y = volumeDimension - temp.z;
		texcoord.x = temp.x;
	}
	else
	{
		texcoord = temp;
	}

    vec4 radiance = CalculateRadiance();

    if(dot(radiance, vec4(1.0f)) <= 0.0f) discard;

	imageAtomicRGBA8Avg(voxelAlbedo, ivec3(texcoord.xyz), radiance);
}