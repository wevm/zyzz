/** Applies scoped style changes and preserves them through Fabric commits. */
#include "NativeZyzz.h"
#include <functional>
#include <unordered_set>
#include <jsi/JSIDynamic.h>
#include <react/renderer/bridging/bridging.h>
#include <react/renderer/core/PropsParserContext.h>
#include <react/renderer/mounting/ShadowTree.h>
#include <react/renderer/mounting/ShadowTreeRegistry.h>

namespace facebook::react {

thread_local const NativeZyzz *NativeZyzz::writing_ = nullptr;

NativeZyzz::NativeZyzz(std::shared_ptr<CallInvoker> invoker)
    : NativeZyzzCxxSpec(std::move(invoker)) {}

NativeZyzz::~NativeZyzz() {
  if (manager_) manager_->unregisterCommitHook(*this);
}

double NativeZyzz::attach(jsi::Runtime &runtime, jsi::Object node, jsi::Object props) {
  auto shadowNode = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(
      runtime, jsi::Value(runtime, node));
  auto values = jsi::dynamicFromValue(runtime, jsi::Value(runtime, props));
  if (!values.isObject()) throw jsi::JSError(runtime, "Native styles must be an object.");

  if (!binding_) {
    binding_ = UIManagerBinding::getBinding(runtime);
    if (!binding_) throw jsi::JSError(runtime, "Zyzz requires Fabric.");
    manager_ = &binding_->getUIManager();
    manager_->registerCommitHook(*this);
  }

  double id;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    id = ++nextId_;
    entries_.emplace(id, Entry{shadowNode->getFamilyShared(), values, values,
                               folly::dynamic::object(), shadowNode->getProps(), nullptr});
  }
  // A React commit can restore its earlier rendered props before the ref relinks.
  write({{shadowNode->getTag(), std::move(values)}});
  return id;
}

void NativeZyzz::detach(jsi::Runtime &, double id) {
  std::shared_ptr<ShadowNodeFamily> family;
  Props::Shared authored;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto entry = entries_.find(id);
    if (entry == entries_.end()) return;
    if (!entry->second.overlay.empty()) {
      family = entry->second.family.lock();
      authored = entry->second.authored;
    }
    entries_.erase(entry);
  }
  if (!family || !authored) return;
  // The React commit has already passed through the overlay hook when an old
  // ref is detached. Restore that commit's authored props, not the old style.
  manager_->getShadowTreeRegistry().visit(family->getSurfaceId(), [&](const ShadowTree &tree) {
    tree.commit([&](const RootShadowNode &root) {
      return std::static_pointer_cast<RootShadowNode>(root.cloneTree(*family,
          [&](const ShadowNode &node) { return node.clone({.props = authored}); }));
    }, {.mountSynchronously = true});
  });
}

jsi::Object NativeZyzz::inspect(jsi::Runtime &runtime) {
  std::lock_guard<std::mutex> lock(mutex_);
  jsi::Object result(runtime);
  result.setProperty(runtime, "batches", batches_);
  result.setProperty(runtime, "bindings", static_cast<double>(entries_.size()));
  result.setProperty(runtime, "writes", writes_);
  return result;
}

void NativeZyzz::update(jsi::Runtime &runtime, std::vector<jsi::Object> updates) {
  std::vector<std::pair<double, folly::dynamic>> selections;
  for (const auto &update : updates) {
    auto id = update.getProperty(runtime, "id").asNumber();
    auto props = jsi::dynamicFromValue(runtime, update.getProperty(runtime, "props"));
    if (!props.isObject()) throw jsi::JSError(runtime, "Native styles must be an object.");
    selections.emplace_back(id, std::move(props));
  }

  std::unordered_map<Tag, folly::dynamic> patches;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &[id, selected] : selections) {
      auto entry = entries_.find(id);
      if (entry == entries_.end()) continue;
      auto family = entry->second.family.lock();
      if (!family) {
        entries_.erase(entry);
        continue;
      }
      if (selected == entry->second.selected) continue;

      folly::dynamic overlay = folly::dynamic::object();
      for (const auto &item : selected.items()) {
        auto rendered = entry->second.rendered.find(item.first);
        if (rendered == entry->second.rendered.items().end() ||
            rendered->second != item.second)
          overlay[item.first] = item.second;
      }
      for (const auto &item : entry->second.rendered.items())
        if (selected.find(item.first) == selected.items().end()) overlay[item.first] = nullptr;

      auto patch = selected;
      for (const auto &item : entry->second.selected.items())
        if (selected.find(item.first) == selected.items().end()) patch[item.first] = nullptr;

      entry->second.overlay = std::move(overlay);
      entry->second.selected = std::move(selected);
      patches.insert_or_assign(family->getTag(), std::move(patch));
    }
    if (patches.empty()) return;
    ++batches_;
    writes_ += patches.size();
  }
  write(std::move(patches));
}

void NativeZyzz::write(std::unordered_map<Tag, folly::dynamic> patches) {
  const auto previous = writing_;
  writing_ = this;
  try {
    manager_->updateShadowTree(std::move(patches));
  } catch (...) {
    writing_ = previous;
    throw;
  }
  writing_ = previous;
}

std::shared_ptr<RootShadowNode> NativeZyzz::shadowTreeWillCommit(
    const ShadowTree &tree,
    const std::shared_ptr<const RootShadowNode> &,
    const std::shared_ptr<RootShadowNode> &next) noexcept {
  struct Overlay {
    std::shared_ptr<ShadowNodeFamily> family;
    folly::dynamic props;
    double id;
  };
  std::unordered_map<const ShadowNodeFamily *, Overlay> overlays;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto entry = entries_.begin(); entry != entries_.end();) {
      auto family = entry->second.family.lock();
      if (!family) {
        entry = entries_.erase(entry);
        continue;
      }
      if (family->getSurfaceId() == tree.getSurfaceId() &&
          !entry->second.overlay.empty())
        overlays.emplace(family.get(), Overlay{family, entry->second.overlay, entry->first});
      ++entry;
    }
  }
  if (overlays.empty()) return next;

  std::unordered_set<const ShadowNodeFamily *> paths;
  for (const auto &[family, overlay] : overlays) {
    paths.insert(family);
    for (const auto &[ancestor, index] : overlay.family->getAncestors(*next))
      paths.insert(&ancestor.get().getFamily());
  }

  PropsParserContext context{tree.getSurfaceId(),
                             *manager_->getContextContainer()};
  std::function<std::shared_ptr<const ShadowNode>(
      const std::shared_ptr<const ShadowNode> &)> visit =
      [&](const std::shared_ptr<const ShadowNode> &node) {
    if (paths.find(&node->getFamily()) == paths.end()) return node;

    std::shared_ptr<std::vector<std::shared_ptr<const ShadowNode>>> children;
    const auto &current = node->getChildren();
    for (size_t index = 0; index < current.size(); ++index) {
      auto child = visit(current[index]);
      if (child == current[index]) continue;
      if (!children)
        children = std::make_shared<
            std::vector<std::shared_ptr<const ShadowNode>>>(current);
      (*children)[index] = std::move(child);
    }

    const auto overlay = overlays.find(&node->getFamily());
    if (!children && overlay == overlays.end()) return node;
    auto props = overlay == overlays.end()
        ? node->getProps()
        : node->getComponentDescriptor().cloneProps(
              context, node->getProps(), RawProps(overlay->second.props));
    if (overlay != overlays.end()) {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto entry = entries_.find(overlay->second.id);
      if (entry != entries_.end()) {
        // Skip our own native patches and nodes reused from an earlier overlay.
        if (writing_ != this && node->getProps() != entry->second.applied)
          entry->second.authored = node->getProps();
        entry->second.applied = props;
      }
    }
    return std::shared_ptr<const ShadowNode>(node->clone({
        .props = props,
        .children = children ? children : ShadowNodeFragment::childrenPlaceholder(),
    }));
  };
  return std::const_pointer_cast<RootShadowNode>(
      std::static_pointer_cast<const RootShadowNode>(visit(next)));
}

}
