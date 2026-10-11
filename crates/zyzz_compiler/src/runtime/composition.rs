//! Ownership data that runtime composition helpers read.

use std::sync::Arc;

/// The attributes, identity, and variable slots one composed style owns.
#[derive(Clone, Debug, PartialEq)]
pub struct Owner {
    /// Recipe attributes the style sets.
    pub attributes: Vec<Arc<str>>,
    /// Class identity of the style.
    pub identity: Arc<str>,
    /// Custom properties the style binds.
    pub slots: Vec<Arc<str>>,
}
