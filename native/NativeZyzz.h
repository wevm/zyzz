/** Owns Fabric style overlays for one React Native runtime. */
#pragma once

#include "ZyzzSpecJSI.h"
#include <folly/dynamic.h>
#include <react/renderer/uimanager/UIManagerBinding.h>
#include <react/renderer/uimanager/UIManagerCommitHook.h>
#include <mutex>
#include <unordered_map>

namespace facebook::react {

class NativeZyzz : public NativeZyzzCxxSpec<NativeZyzz>, public UIManagerCommitHook {
 public:
  explicit NativeZyzz(std::shared_ptr<CallInvoker> invoker);
  ~NativeZyzz() override;

  double attach(jsi::Runtime &runtime, jsi::Object node, jsi::Object props);
  void detach(jsi::Runtime &runtime, double id);
  jsi::Object inspect(jsi::Runtime &runtime);
  void update(jsi::Runtime &runtime, std::vector<jsi::Object> updates);

  void commitHookWasRegistered(const UIManager &) noexcept override {}
  void commitHookWasUnregistered(const UIManager &) noexcept override {}
  std::shared_ptr<RootShadowNode> shadowTreeWillCommit(
      const ShadowTree &tree,
      const std::shared_ptr<const RootShadowNode> &previous,
      const std::shared_ptr<RootShadowNode> &next) noexcept override;

 private:
  struct Entry {
    std::weak_ptr<ShadowNodeFamily> family;
    folly::dynamic rendered;
    folly::dynamic selected;
    folly::dynamic overlay;
  };

  void write(std::unordered_map<Tag, folly::dynamic> patches);

  std::shared_ptr<UIManagerBinding> binding_;
  UIManager *manager_ = nullptr;
  std::unordered_map<double, Entry> entries_;
  std::mutex mutex_;
  double nextId_ = 0;
  double batches_ = 0;
  double writes_ = 0;
};

}
