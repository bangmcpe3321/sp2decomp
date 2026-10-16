cmake_minimum_required(VERSION 3.20)
project(sp2port LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE RelWithDebInfo)
endif()

add_library(nnos STATIC
  src/os.cpp
  src/util.cpp
  src/services.cpp
  src/init.cpp
)
target_include_directories(nnos PUBLIC include)
find_package(Threads REQUIRED)
target_link_libraries(nnos PUBLIC Threads::Threads)

# Warnings that matter for ABI-faithful reconstruction work.
if(MSVC)
  target_compile_options(nnos PRIVATE /W4)
else()
  target_compile_options(nnos PRIVATE -Wall -Wextra -Wpedantic)
endif()

option(SP2PORT_BUILD_TESTS "Build the platform contract tests" ON)
if(SP2PORT_BUILD_TESTS)
  enable_testing()
  add_executable(platform_tests tests/platform_contract_tests.cpp)
  target_link_libraries(platform_tests PRIVATE nnos)
  add_test(NAME platform_contract COMMAND platform_tests)

  add_executable(services_tests tests/services_tests.cpp)
  target_link_libraries(services_tests PRIVATE nnos)
  add_test(NAME services_contract COMMAND services_tests)

  # Replays the real boot sequence rather than testing functions in isolation.
  add_executable(boot_integration tests/boot_integration.cpp)
  target_link_libraries(boot_integration PRIVATE nnos)
  add_test(NAME boot_sequence COMMAND boot_integration)
endif()
