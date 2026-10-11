//! Reads dynamic style callbacks into typed runtime slots.

use std::sync::Arc;

use crate::internal::binding;
use crate::js::Record;

/// Typed runtime slots by field name.
pub type Slots = Record<Arc<binding::Reference>>;
