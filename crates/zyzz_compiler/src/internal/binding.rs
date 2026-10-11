//! Typed runtime variable slots that styles bind without emitting new rules.

use crate::generated::binding_domains;

/// The value domain a binding accepts.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Domain {
    /// `*`: any scalar.
    Any,
    /// A color.
    Color,
    /// A non-negative length.
    Length,
    /// A number.
    Number,
    /// A non-negative percentage.
    Percentage,
    /// A length that may be negative.
    SignedLength,
    /// A percentage that may be negative.
    SignedPercentage,
}

impl Domain {
    /// Parses the TypeScript spelling of a domain.
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "*" => Self::Any,
            "color" => Self::Color,
            "length" => Self::Length,
            "number" => Self::Number,
            "percentage" => Self::Percentage,
            "signedLength" => Self::SignedLength,
            "signedPercentage" => Self::SignedPercentage,
            _ => return None,
        })
    }

    /// The TypeScript spelling of this domain.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Any => "*",
            Self::Color => "color",
            Self::Length => "length",
            Self::Number => "number",
            Self::Percentage => "percentage",
            Self::SignedLength => "signedLength",
            Self::SignedPercentage => "signedPercentage",
        }
    }
}

/// A variable slot bound at runtime.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct Reference {
    /// Whether the slot holds a per-application dynamic value.
    pub dynamic: bool,
    /// Custom property name, including the `--` prefix.
    pub name: String,
    /// Accepted value domain.
    pub domain: Domain,
    /// Whether an empty string binds as zero, for string-typed numeric slots.
    pub zero: bool,
}

/// Whether a custom property name is a valid binding name.
pub fn valid_name(name: &str) -> bool {
    name.strip_prefix("--").is_some_and(|rest| {
        !rest.is_empty()
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    })
}

/// Whether a property accepts values from a binding domain.
pub fn accepts(domain: Domain, property: &str) -> bool {
    if domain == Domain::Any || property.starts_with("--") {
        return true;
    }

    binding_domains::properties(domain.as_str())
        .is_some_and(|properties| properties.contains(&property))
}
