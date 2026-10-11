//! Incremental graph compilers that hosts address by handle across the JSON boundary.
//!
//! Hosts create a compiler, compile snapshots with it, and release it, so each handle owns the
//! cache of one host lifecycle. A compilation result marks modules whose output is the same value
//! the previous result of that handle returned, which lets hosts keep their decoded objects.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use rustc_hash::FxHashMap;
use serde_json::Value;

use crate::compiler::graph::{self, Graph, Map, Output, Resource};
use crate::compiler::internal::stylesheets::Rendered;
use crate::compiler::transform;
use crate::error::{Error, Result};
use crate::internal::token::{Composition, CssOutput};
use crate::js;
use crate::web::internal::themes::Shared;

struct Entry {
    graph: Graph,
    previous: Option<Arc<Output>>,
}

/// Live compilers by handle. Only the host adapters' explicit create and release calls change
/// membership, so a handle's cache lives exactly as long as the host compiler that owns it.
static GRAPHS: Mutex<Option<FxHashMap<u32, Entry>>> = Mutex::new(None);
static NEXT: AtomicU32 = AtomicU32::new(1);

fn malformed(message: &str) -> Error {
    Error::Message(format!("Malformed graph input: {message}"))
}

fn strings(value: Option<&Value>, field: &str) -> Result<Option<Map<Arc<str>>>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(object)) => object
            .iter()
            .map(|(key, value)| {
                value
                    .as_str()
                    .map(|value| (Arc::from(key.as_str()), Arc::from(value)))
                    .ok_or_else(|| malformed(field))
            })
            .collect::<Result<_>>()
            .map(Some),
        Some(_) => Err(malformed(field)),
    }
}

fn text(value: Option<&Value>) -> Option<Arc<str>> {
    value.and_then(Value::as_str).map(Arc::from)
}

/// Decodes graph options from their JSON form.
///
/// # Errors
///
/// Returns a plain error for malformed input.
pub fn options(input: &Value) -> Result<graph::Options> {
    let field = |name: &str| input.get(name).filter(|value| !value.is_null());
    let imports = match field("imports") {
        None => None,
        Some(Value::Object(imports)) => Some(
            imports
                .iter()
                .map(|(id, specifiers)| {
                    let Value::Object(specifiers) = specifiers else {
                        return Err(malformed("imports"));
                    };
                    let specifiers = specifiers
                        .iter()
                        .map(|(specifier, target)| match target {
                            Value::Null => Ok((Arc::from(specifier.as_str()), None)),
                            Value::String(target) => Ok((
                                Arc::from(specifier.as_str()),
                                Some(Arc::from(target.as_str())),
                            )),
                            _ => Err(malformed("imports")),
                        })
                        .collect::<Result<_>>()?;

                    Ok((Arc::from(id.as_str()), specifiers))
                })
                .collect::<Result<_>>()?,
        ),
        Some(_) => return Err(malformed("imports")),
    };
    let composition = match field("composition").and_then(Value::as_str) {
        None => None,
        Some(value) => Some(Composition::parse(value).ok_or_else(|| malformed("composition"))?),
    };
    let css_output = match field("cssOutput").and_then(Value::as_str) {
        None => None,
        Some(value) => Some(CssOutput::parse(value).ok_or_else(|| malformed("cssOutput"))?),
    };
    let shared = match field("shared").and_then(Value::as_str) {
        None => None,
        Some("all") => Some(Shared::All),
        Some("defaults") => Some(Shared::Defaults),
        Some(_) => return Err(malformed("shared")),
    };

    Ok(graph::Options {
        complete: field("complete")
            .and_then(Value::as_bool)
            .unwrap_or_default(),
        compiler: field("compiler").and_then(Value::as_bool),
        composition,
        contracts: strings(field("contracts"), "contracts")?,
        css_output,
        development: field("development")
            .and_then(Value::as_bool)
            .unwrap_or_default(),
        entry: text(field("entry")),
        imports,
        modules: strings(field("modules"), "modules")?.unwrap_or_default(),
        reset: text(field("reset")),
        shared,
    })
}

fn write_record<'r>(output: &mut String, entries: impl Iterator<Item = (&'r str, &'r str)>) {
    js::write_object(output, entries, js::write_string);
}

fn write_rendered(output: &mut String, rendered: &Rendered) {
    output.push_str("\"assets\":");
    write_record(
        output,
        rendered
            .assets
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str())),
    );
    output.push_str(",\"css\":");
    js::write_string(output, &rendered.css);
    output.push_str(",\"map\":");
    output.push_str(&rendered.map.to_json());
    output.push_str(",\"owners\":");
    write_record(
        output,
        rendered
            .owners
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str())),
    );
}

fn write_resource(output: &mut String, resource: &Resource) {
    output.push_str("{\"id\":");
    js::write_string(output, &resource.id);
    output.push(',');
    write_rendered(output, &resource.rendered);
    output.push('}');
}

/// Appends one module's transform output.
pub fn write_module(output: &mut String, module: &transform::Output) {
    output.push_str("{\"classes\":");
    write_record(
        output,
        module
            .classes
            .iter()
            .map(|(name, value)| (&**name, value.as_str())),
    );
    output.push_str(",\"code\":");
    js::write_string(output, &module.code);
    output.push_str(",\"css\":");
    js::write_string(output, &module.css);
    output.push_str(",\"cssMap\":");
    output.push_str(&module.css_map.to_json());
    output.push_str(",\"map\":");
    output.push_str(&module.map);
    output.push_str(",\"rules\":");
    write_record(
        output,
        module
            .rules
            .iter()
            .map(|(name, rule)| (name.as_str(), rule.as_str())),
    );

    if let Some(resources) = &module.shared {
        output.push_str(",\"shared\":[");

        for (index, resource) in resources.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push_str("{\"css\":");
            js::write_string(output, &resource.css);
            output.push_str(",\"id\":");
            js::write_string(output, &resource.id);

            if let Some(rules) = &resource.rules {
                output.push_str(",\"rules\":[");

                for (index, rule) in rules.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }

                    output.push_str("{\"conditions\":[");

                    for (index, condition) in rule.conditions.iter().enumerate() {
                        if index > 0 {
                            output.push(',');
                        }

                        js::write_string(output, condition);
                    }

                    output.push_str("],\"property\":");
                    js::write_string(output, &rule.property);
                    output.push_str(",\"selector\":");
                    js::write_string(output, &rule.selector);
                    output.push_str(",\"value\":");
                    js::write_string(output, &rule.value);
                    output.push('}');
                }

                output.push(']');
            }

            output.push('}');
        }

        output.push(']');
    }

    output.push_str(",\"units\":[");

    for (index, (key, decision)) in module.units.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');
        js::write_string(output, key);
        output.push_str(if decision.borrowed {
            ",true,"
        } else {
            ",false,"
        });
        js::write_string(output, &decision.name);
        output.push(']');
    }

    output.push_str("],\"vars\":");
    write_record(
        output,
        module
            .vars
            .iter()
            .map(|(name, value)| (&**name, value.as_str())),
    );
    output.push('}');
}

/// Serializes a graph result. Modules whose output is the value `previous` holds become `0`.
pub fn write_output(result: &Output, previous: Option<&Output>) -> String {
    let mut output = String::from("{\"contracts\":");

    write_record(
        &mut output,
        result
            .contracts
            .iter()
            .map(|(id, contract)| (&**id, contract.as_str())),
    );
    output.push_str(",\"dependencies\":");
    js::write_object(
        &mut output,
        result
            .dependencies
            .iter()
            .map(|(id, targets)| (&**id, targets)),
        |output, targets| {
            output.push('[');

            for (index, target) in targets.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                js::write_string(output, target);
            }

            output.push(']');
        },
    );
    output.push_str(",\"modules\":");
    js::write_object(
        &mut output,
        result
            .modules
            .iter()
            .map(|(id, module)| (&**id, (id, module))),
        |output, (id, module)| {
            let same = previous
                .and_then(|previous| previous.modules.get(&**id))
                .is_some_and(|previous| Arc::ptr_eq(previous, module));

            if same {
                output.push('0');
            } else {
                write_module(output, module);
            }
        },
    );

    if !result.packed.is_empty() {
        output.push_str(",\"packed\":[");

        for (index, resource) in result.packed.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            write_resource(&mut output, resource);
        }

        output.push(']');
    }

    if let Some(reset) = &result.reset {
        output.push_str(",\"reset\":");
        write_resource(&mut output, reset);
    }

    if let Some(shared) = &result.shared {
        output.push_str(",\"shared\":{");
        write_rendered(&mut output, shared);
        output.push('}');
    }

    output.push('}');
    output
}

/// Creates an incremental compiler and returns its handle.
pub fn create() -> u32 {
    let handle = NEXT.fetch_add(1, Ordering::Relaxed);
    let mut graphs = GRAPHS.lock().unwrap_or_else(PoisonError::into_inner);

    graphs.get_or_insert_with(FxHashMap::default).insert(
        handle,
        Entry {
            graph: Graph::default(),
            previous: None,
        },
    );

    handle
}

/// Releases a compiler and its cache. Unknown handles are ignored.
pub fn release(handle: u32) {
    let mut graphs = GRAPHS.lock().unwrap_or_else(PoisonError::into_inner);

    if let Some(graphs) = graphs.as_mut() {
        graphs.remove(&handle);
    }
}

/// Compiles a snapshot, with the compiler of `handle` when one is given. A result identical to
/// the handle's previous result serializes as `{"same":true}`.
///
/// # Errors
///
/// Returns the graph's compilation errors, and a plain error for an unknown handle.
pub fn compile(input: &Value) -> Result<String> {
    let options = options(input)?;
    let Some(handle) = input
        .get("handle")
        .and_then(Value::as_u64)
        .and_then(|handle| u32::try_from(handle).ok())
    else {
        return Ok(write_output(&*graph::compile(&options)?, None));
    };

    // Compile outside the lock, so compilers of other handles stay usable meanwhile.
    let mut entry = {
        let mut graphs = GRAPHS.lock().unwrap_or_else(PoisonError::into_inner);

        graphs
            .as_mut()
            .and_then(|graphs| graphs.remove(&handle))
            .ok_or_else(|| Error::Message(format!("Unknown graph compiler: {handle}")))?
    };
    let result = entry.graph.compile(&options);
    let written = result.map(|result| {
        let same = entry
            .previous
            .as_ref()
            .is_some_and(|previous| Arc::ptr_eq(previous, &result));
        let written = if same {
            "{\"same\":true}".to_owned()
        } else {
            write_output(&result, entry.previous.as_deref())
        };

        entry.previous = Some(result);
        written
    });
    let mut graphs = GRAPHS.lock().unwrap_or_else(PoisonError::into_inner);

    graphs
        .get_or_insert_with(FxHashMap::default)
        .insert(handle, entry);

    written
}

/// Compiles one module outside a graph, as `Transform.compile` does.
///
/// # Errors
///
/// Returns extraction and emission errors, and the TypeScript message for native targets.
pub fn transform(input: &Value) -> Result<String> {
    let field = |name: &str| input.get(name).filter(|value| !value.is_null());

    if field("target").and_then(Value::as_str) == Some("native") {
        return Err(Error::Message(
            "Use Native.compile for native source output.".to_owned(),
        ));
    }

    let module_id = field("moduleId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let source = field("source").and_then(Value::as_str).unwrap_or_default();
    let compiler = field("compiler").and_then(Value::as_bool);
    let options = options(input)?;
    let allocator = oxc_allocator::Allocator::default();
    let parsed = crate::compiler::internal::syntax::parse(&allocator, source, module_id);
    let extracted = crate::compiler::source::extract(
        &allocator,
        &crate::compiler::source::Options {
            compiler,
            context: None,
            module_id,
            parsed: Some(&parsed),
            source,
            target: crate::compiler::source::Target::Web,
        },
    )?;
    let output = transform::compile(
        &transform::Options {
            compiler: compiler != Some(false),
            composition: options.composition,
            css_output: options.css_output,
            development: options.development,
            module_id,
            owners: None,
            schemes: field("schemes").and_then(Value::as_bool),
            shared: options.shared,
            source,
            style_classes: None,
        },
        &extracted,
        &parsed,
        None,
    )?;
    let mut written = String::new();

    write_module(&mut written, &output);

    Ok(written)
}
