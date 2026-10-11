//! Defines and extends variable sets, mirroring the `Vars` authoring namespace.

use std::sync::Arc;

use crate::data::Data;
use crate::error::Result;
use crate::internal::identity;
use crate::internal::theme::Definition;
use crate::internal::token::{Contract, Expression};
use crate::internal::variable_sets::{self, BuildOptions};

/// A statically evaluated derive callback that receives the base set's variables.
pub type Derive<'a> = &'a dyn Fn(&Definition) -> Result<Data>;

/// Composes CSS text, numbers, and references into one color or spacing variable value.
///
/// # Errors
///
/// Returns `Vars.InvalidError` for unsupported domains and parts.
pub fn compose(group: &str, parts: &[Data]) -> Result<Arc<Expression>> {
    variable_sets::compose(group, parts)
}

/// Defines a variable set, optionally deriving more variables from the first build.
///
/// # Errors
///
/// Returns `Vars.InvalidError` for invalid records and derived replacements.
pub fn define(values: &Data, derive: Option<Derive<'_>>, id: Option<&str>) -> Result<Definition> {
    let contract = Arc::new(match id {
        Some(id) => Contract {
            complete: true,
            identity: Some(identity::require_id(Some(id), "Vars.define")?.into()),
            variable_set: true,
            ..Contract::default()
        },
        None => Contract {
            variable_set: true,
            ..Contract::default()
        },
    });
    let base = variable_sets::build(values, &contract, &BuildOptions::default())?;
    let Some(derive) = derive else {
        return Ok(base);
    };
    let merged = variable_sets::merge(values, &derive(&base)?, &[])?;

    variable_sets::build(&merged, &contract, &BuildOptions::default())
}

/// Extends a variable set with new paths and overrides of existing values.
///
/// A named extension owns its paths and reads inherited ones through the base's variables.
///
/// # Errors
///
/// Returns `Vars.InvalidError` when the input is not a variable set or the extension is invalid.
pub fn extend(
    variables: &Definition,
    values: &Data,
    derive: Option<Derive<'_>>,
    id: Option<&str>,
) -> Result<Definition> {
    let metadata = &variables.metadata;

    if !metadata.contract.variable_set {
        return Err(crate::error::Error::Vars {
            message: "Expected a variable set.".to_owned(),
            path: Vec::new(),
        });
    }

    let contract = match id {
        None => Arc::clone(&metadata.contract),
        Some(id) => Arc::new(Contract {
            complete: true,
            identity: Some(identity::require_id(Some(id), "Vars.extend")?.into()),
            variable_set: true,
            ..Contract::default()
        }),
    };
    let base = match id {
        None => metadata.clone(),
        Some(_) => {
            variable_sets::build(
                &variable_sets::references(variables, metadata),
                &contract,
                &BuildOptions::default(),
            )?
            .metadata
        }
    };
    let extended = variable_sets::build(
        values,
        &contract,
        &BuildOptions {
            base: Some(&base),
            derived: false,
        },
    )?;
    let Some(derive) = derive else {
        return Ok(extended);
    };

    variable_sets::build(
        &derive(&extended)?,
        &contract,
        &BuildOptions {
            base: Some(&extended.metadata),
            derived: true,
        },
    )
}
