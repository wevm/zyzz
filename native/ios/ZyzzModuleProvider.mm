/** Registers the shared C++ adapter with React Native on iOS. */
#import <ReactCommon/RCTTurboModule.h>
#import "NativeZyzz.h"

@interface ZyzzModuleProvider : NSObject <RCTModuleProvider>
@end

@implementation ZyzzModuleProvider
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeZyzz>(params.jsInvoker);
}
@end
