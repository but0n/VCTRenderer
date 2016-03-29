#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include "shadow_map_renderer.h"

#include "../scene/light.h"
#include "../programs/depth_program.h"
#include "../../../scene/scene.h"
#include "../../../core/assets_manager.h"

#include <oglplus/context.hpp>
#include <oglplus/bound/texture.hpp>

void ShadowMapRenderer::SetMatricesUniforms(const Node &node) const
{
    auto &prog = CurrentProgram<DepthProgram>();
    static auto &camera = Camera::Active();
    prog.matrices.modelViewProjection.Set(camera->ProjectionMatrix() *
                                          camera->ViewMatrix() *
                                          node.ModelMatrix());
}

void ShadowMapRenderer::Render()
{
    using namespace oglplus;
    static Context gl;
    static auto &scene = Scene::Active();
    auto camera = Camera::Active().get();

    if (!camera || !scene || !scene->IsLoaded() || !shadowCaster)
    {
        return;
    }

    SetAsActive();
    lightView.SetAsActive();
    shadowFramebuffer.Bind(FramebufferTarget::Draw);
    gl.ColorMask(false, false, false, false);
    gl.Viewport(shadowMapSize.x, shadowMapSize.y);
    gl.ClearColor(0.0f, 0.0f, 0.0f, 0.0f);
    gl.Clear().DepthBuffer();
    // activate geometry pass shader program
    CurrentProgram<DepthProgram>(DepthShader());
    // rendering flags
    gl.Enable(Capability::DepthTest);
    gl.Enable(Capability::CullFace);
    gl.CullFace(Face::Front);
    // scene spatial cues
    auto sceneBB = scene->rootNode->boundaries;
    auto &center = sceneBB.Center();
    auto radius = distance(center, sceneBB.MaxPoint());
    auto direction = -shadowCaster->Direction();
    // fix light frustum to fit scene bounding sphere
    lightView.OrthoRect(glm::vec4(-radius, radius, -radius, radius));
    lightView.ClipPlaneNear(-radius);
    lightView.ClipPlaneFar(2.0f * radius);
    lightView.Projection(Camera::ProjectionMode::Orthographic);
    lightView.transform.Position(center - direction * radius);
    lightView.transform.Forward(direction);
    // draw whole scene tree from root node
    scene->rootNode->DrawList();
    // recover original render camera
    camera->SetAsActive();
    DefaultFramebuffer().Bind(FramebufferTarget::Draw);
}

void ShadowMapRenderer::Caster(const Light * caster)
{
    shadowCaster = caster;
}

const glm::mat4x4 &ShadowMapRenderer::LightSpaceMatrix()
{
    static glm::mat4 biasMatrix(0.5, 0.0, 0.0, 0.0,
                                0.0, 0.5, 0.0, 0.0,
                                0.0, 0.0, 0.5, 0.0,
                                0.5, 0.5, 0.5, 1.0);
    return lightSpaceMatrix = biasMatrix * lightView.ProjectionMatrix()
                              * lightView.ViewMatrix();
}

const Light * ShadowMapRenderer::Caster() const
{
    return shadowCaster;
}

void ShadowMapRenderer::BindReading(unsigned unit) const
{
    renderDepth.Active(unit);
    renderDepth.Bind(oglplus::TextureTarget::_2D);
}

const Camera &ShadowMapRenderer::LightCamera() const
{
    return lightView;
}

const oglplus::Texture &ShadowMapRenderer::ShadowMap() const
{
    return renderDepth;
}

ShadowMapRenderer::ShadowMapRenderer(RenderWindow &window) : Renderer(window),
    shadowCaster(nullptr)
{
    CreateFramebuffer(2048, 2048);
}

ShadowMapRenderer::~ShadowMapRenderer()
{
}

DepthProgram &ShadowMapRenderer::DepthShader()
{
    static auto &assets = AssetsManager::Instance();
    static auto &prog = *static_cast<DepthProgram *>
                        (assets->programs["Depth"].get());
    return prog;
}

void ShadowMapRenderer::CreateFramebuffer(const unsigned &w,
        const unsigned &h)
{
    using namespace oglplus;
    static Context gl;
    shadowMapSize = glm::uvec2(w, h);
    shadowFramebuffer.Bind(FramebufferTarget::Draw);
    gl.Bound(TextureTarget::_2D, renderDepth)
    .Image2D(0, PixelDataInternalFormat::DepthComponent24, w, h, 0,
             PixelDataFormat::DepthComponent, PixelDataType::Float, nullptr)
    .MinFilter(TextureMinFilter::Linear).MagFilter(TextureMagFilter::Linear)
    .WrapS(TextureWrap::ClampToEdge).WrapT(TextureWrap::ClampToEdge)
    .CompareMode(TextureCompareMode::CompareRefToTexture)
    .CompareFunc(CompareFunction::LEqual);
    shadowFramebuffer.AttachTexture(FramebufferTarget::Draw,
                                    FramebufferAttachment::Depth,
                                    renderDepth, 0);
    gl.DrawBuffer(ColorBuffer::None);

    // check if success building frame buffer
    if (!Framebuffer::IsComplete(FramebufferTarget::Draw))
    {
        auto status = Framebuffer::Status(FramebufferTarget::Draw);
        Framebuffer::HandleIncompleteError(FramebufferTarget::Draw, status);
    }

    Framebuffer::Bind(Framebuffer::Target::Draw, FramebufferName(0));
}