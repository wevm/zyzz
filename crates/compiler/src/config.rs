//! Binds shared vars, property mappings, and scoped alternatives to authoring, mirroring the
//! public `Config` namespace.

use crate::data::Data;
use crate::error::{Error, Result};
use crate::internal::configuration::{self, Configuration};

/// Options the public factory rejects in favor of `vars` and `defaultVars`.
const LEGACY: [&str; 3] = ["theme", "themes", "defaultTheme"];

/// Creates isolated authoring with optional vars and named alternatives, as `Config.create` does.
///
/// # Errors
///
/// Returns `Config.InvalidError` for theme options and every [`configuration::create`] failure.
pub fn create(options: &Data) -> Result<Configuration> {
    if let Data::Object(object) = options {
        for key in LEGACY {
            if object.has(key) {
                return Err(Error::Config(format!(
                    "Use vars and defaultVars instead of {key}."
                )));
            }
        }
    }

    configuration::create(options)
}
