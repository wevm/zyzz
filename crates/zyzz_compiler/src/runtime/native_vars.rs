//! The immutable native variable tables that `NativeVars.create` binds for `useVars`.
//!
//! A profile is an encoded tree: each leaf is a converted string or number, nested records keep
//! JavaScript own-property order, and a one-element string array holds the deferred diagnostic of
//! an unsupported leaf.

use std::sync::Arc;

use crate::data::Object;
use crate::js;
use crate::react_native::style_sheet;
use crate::runtime::internal::native_media::{self, Query};

/// Static values for one set, nested under their authored variable paths.
pub type EncodedTree = Object;

/// Dark and light trees for one set.
#[derive(Clone, Debug)]
pub struct Profile {
    /// Dark values.
    pub dark: EncodedTree,
    /// Light values.
    pub light: EncodedTree,
}

/// Profiles keyed by set name, in JavaScript own-property order.
pub type Profiles = Vec<(Arc<str>, Profile)>;

/// Precompiled alternatives for supported window queries.
#[derive(Clone, Debug)]
pub struct Media {
    /// Profiles keyed by selection, one `0` or `1` per query.
    pub profiles: Vec<(Arc<str>, Profiles)>,
    /// Queries in selection order.
    pub queries: Vec<Query>,
}

/// Static tables and the owning configuration's default name.
#[derive(Clone, Debug)]
pub struct Options {
    /// Fallback when the Provider omits its selection.
    pub default_vars: Option<Arc<str>>,
    /// Precompiled alternatives for supported window queries.
    pub media: Option<Media>,
    /// Native values for every configured name and scheme.
    pub profiles: Profiles,
    /// A standalone definition whose values do not depend on the selected name.
    pub unnamed: bool,
}

impl Options {
    /// Appends the options serialized like `JSON.stringify`, in the key order
    /// `NativeVars.compile` constructs.
    pub fn write_json(&self, output: &mut String) {
        output.push('{');

        if let Some(default_vars) = &self.default_vars {
            output.push_str("\"defaultVars\":");
            js::write_string(output, default_vars);
            output.push(',');
        }

        if let Some(media) = &self.media {
            output.push_str("\"media\":{\"profiles\":");
            js::write_object(
                output,
                media
                    .profiles
                    .iter()
                    .map(|(selection, profiles)| (&**selection, profiles)),
                write_profiles,
            );
            output.push_str(",\"queries\":");
            native_media::write_queries(output, &media.queries);
            output.push_str("},");
        }

        output.push_str("\"profiles\":");
        write_profiles(output, &self.profiles);
        output.push_str(",\"unnamed\":");
        output.push_str(if self.unnamed { "true" } else { "false" });
        output.push('}');
    }

    /// Serializes like `JSON.stringify`.
    pub fn to_json(&self) -> String {
        let mut output = String::new();

        self.write_json(&mut output);
        output
    }
}

fn write_profiles(output: &mut String, profiles: &Profiles) {
    js::write_object(
        output,
        profiles.iter().map(|(name, profile)| (&**name, profile)),
        |output, profile| {
            output.push_str("{\"dark\":");
            style_sheet::write_table(output, &profile.dark);
            output.push_str(",\"light\":");
            style_sheet::write_table(output, &profile.light);
            output.push('}');
        },
    );
}
