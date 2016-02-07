//  File implement/oglplus/enums/context_profile_bit_def.ipp
//
//  Automatically generated file, DO NOT modify manually.
//  Edit the source 'source/enums/oglplus/context_profile_bit.txt'
//  or the 'source/enums/make_enum.py' script instead.
//
//  Copyright 2010-2015 Matus Chochlik.
//  Distributed under the Boost Software License, Version 1.0.
//  See accompanying file LICENSE_1_0.txt or copy at
//  http://www.boost.org/LICENSE_1_0.txt
//
#ifdef OGLPLUS_LIST_NEEDS_COMMA
# undef OGLPLUS_LIST_NEEDS_COMMA
#endif

#if defined GL_CONTEXT_CORE_PROFILE_BIT
# ifdef OGLPLUS_LIST_NEEDS_COMMA
   OGLPLUS_ENUM_CLASS_COMMA
# endif
# if defined Core
#  pragma push_macro("Core")
#  undef Core
   OGLPLUS_ENUM_CLASS_VALUE(Core, GL_CONTEXT_CORE_PROFILE_BIT)
#  pragma pop_macro("Core")
# else
   OGLPLUS_ENUM_CLASS_VALUE(Core, GL_CONTEXT_CORE_PROFILE_BIT)
# endif
# ifndef OGLPLUS_LIST_NEEDS_COMMA
#  define OGLPLUS_LIST_NEEDS_COMMA 1
# endif
#endif
#if defined GL_CONTEXT_COMPATIBILITY_PROFILE_BIT
# ifdef OGLPLUS_LIST_NEEDS_COMMA
   OGLPLUS_ENUM_CLASS_COMMA
# endif
# if defined Compatibility
#  pragma push_macro("Compatibility")
#  undef Compatibility
   OGLPLUS_ENUM_CLASS_VALUE(Compatibility, GL_CONTEXT_COMPATIBILITY_PROFILE_BIT)
#  pragma pop_macro("Compatibility")
# else
   OGLPLUS_ENUM_CLASS_VALUE(Compatibility, GL_CONTEXT_COMPATIBILITY_PROFILE_BIT)
# endif
# ifndef OGLPLUS_LIST_NEEDS_COMMA
#  define OGLPLUS_LIST_NEEDS_COMMA 1
# endif
#endif
#ifdef OGLPLUS_LIST_NEEDS_COMMA
# undef OGLPLUS_LIST_NEEDS_COMMA
#endif

