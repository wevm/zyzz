//! Names the stylesheet classes that select a color scheme beside a theme scope.

/// Scheme class names in authored order.
pub const CLASSES: [(&str, &str); 3] = [
    ("dark", "z_scheme-dark"),
    ("light", "z_scheme-light"),
    ("light dark", "z_scheme-light-dark"),
];

/// Looks up the class for a color scheme.
pub fn class(scheme: &str) -> Option<&'static str> {
    CLASSES
        .iter()
        .find(|(name, _)| *name == scheme)
        .map(|(_, class)| *class)
}

/// Rules that apply each scheme class.
pub fn css() -> String {
    let mut output = String::new();

    for (index, (scheme, class)) in CLASSES.iter().enumerate() {
        if index > 0 {
            output.push('\n');
        }

        output.push('.');
        output.push_str(class);
        output.push_str("{color-scheme:");
        output.push_str(scheme);
        output.push_str(";}");
    }

    output
}
