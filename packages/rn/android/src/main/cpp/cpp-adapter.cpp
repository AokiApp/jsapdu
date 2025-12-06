#include <jni.h>
#include "aokiapp_jsapdurnOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::aokiapp_jsapdurn::initialize(vm);
}
