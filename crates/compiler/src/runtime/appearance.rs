//! Serializes the script that restores a saved root set and scheme selection before paint.

use std::fmt::Write as _;
use std::sync::Arc;

use crate::internal::scheme;
use crate::js;

/// Serializes the HTML-safe initialization script for compiled named set classes, as
/// `Appearance.create(entries, { storageKey })()` returns it.
///
/// `storage_key` defaults to `zyzz`. The script reads `localStorage` and the document root only
/// when it runs.
pub fn script(entries: &[(Arc<str>, Arc<str>)], storage_key: Option<&str>) -> String {
    let mut catalog = String::from("[");

    for (index, (name, class)) in entries.iter().enumerate() {
        if index > 0 {
            catalog.push(',');
        }

        catalog.push('[');
        js::write_string(&mut catalog, name);
        catalog.push(',');
        js::write_string(&mut catalog, class);
        catalog.push(']');
    }

    catalog.push(']');

    let mut schemes = String::from("[");

    for (index, (name, class)) in scheme::CLASSES.iter().enumerate() {
        if index > 0 {
            schemes.push(',');
        }

        schemes.push('[');
        js::write_string(&mut schemes, name);
        schemes.push(',');
        js::write_string(&mut schemes, class);
        schemes.push(']');
    }

    schemes.push(']');

    let catalog = safe(&catalog);
    let key = safe(&js::quote(storage_key.unwrap_or("zyzz")));
    let schemes = safe(&schemes);

    format!(
        "(()=>{{try{{const value=JSON.parse(localStorage.getItem({key})||\"null\");if(!value||typeof value!==\"object\"||Array.isArray(value))return;const root=document.documentElement;const catalog=new Map({catalog});if(Object.hasOwn(value,\"set\")&&typeof value.set===\"string\"&&catalog.has(value.set)){{root.classList.remove(...catalog.values());root.classList.add(catalog.get(value.set))}}const schemes=new Map({schemes});if(Object.hasOwn(value,\"colorScheme\")){{if(value.colorScheme===null){{root.classList.remove(...schemes.values());root.style.removeProperty(\"color-scheme\")}}else if(schemes.has(value.colorScheme)){{root.classList.remove(...schemes.values());root.classList.add(schemes.get(value.colorScheme));root.style.colorScheme=value.colorScheme}}}}}}catch{{}}}})();"
    )
}

/// Escapes `<`, `>`, `&`, U+2028, and U+2029 in serialized JSON so it can sit inside a script
/// element.
fn safe(json: &str) -> String {
    let mut output = String::with_capacity(json.len());

    for character in json.chars() {
        if matches!(character, '<' | '>' | '&' | '\u{2028}' | '\u{2029}') {
            let _ = write!(output, "\\u{:04x}", u32::from(character));
        } else {
            output.push(character);
        }
    }

    output
}
