//! Comparison data that selects precompiled media alternatives from native window dimensions.
//!
//! The compiler emits one alternative per selection key: a string with one `0` or `1` per query,
//! in query order.

use crate::js;

/// A comparison operand: a logical-unit threshold or a window dimension.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Operand {
    /// The window height.
    Height,
    /// A threshold in logical units.
    Number(f64),
    /// The window width.
    Width,
}

/// A comparison operator.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Operator {
    /// `=`
    Equal,
    /// `>`
    Greater,
    /// `>=`
    GreaterEqual,
    /// `<`
    Less,
    /// `<=`
    LessEqual,
}

impl Operator {
    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Equal => "=",
            Self::Greater => ">",
            Self::GreaterEqual => ">=",
            Self::Less => "<",
            Self::LessEqual => "<=",
        }
    }
}

/// A media query lowered to window comparisons.
#[derive(Clone, Debug, PartialEq)]
pub enum Query {
    /// Every query matches.
    And(Vec<Query>),
    /// One comparison.
    Compare {
        /// Left operand.
        left: Operand,
        /// Operator.
        operator: Operator,
        /// Right operand.
        right: Operand,
    },
    /// The query does not match.
    Not(Box<Query>),
    /// Some query matches.
    Or(Vec<Query>),
}

impl Query {
    /// Appends the query serialized like `JSON.stringify`, in the key order the compiler
    /// constructs.
    pub fn write_json(&self, output: &mut String) {
        match self {
            Self::And(queries) | Self::Or(queries) => {
                output.push_str(if matches!(self, Self::And(_)) {
                    "{\"kind\":\"and\",\"queries\":"
                } else {
                    "{\"kind\":\"or\",\"queries\":"
                });
                write_queries(output, queries);
                output.push('}');
            }
            Self::Compare {
                left,
                operator,
                right,
            } => {
                output.push_str("{\"kind\":\"compare\",\"left\":");
                write_operand(output, *left);
                output.push_str(",\"operator\":");
                js::write_string(output, operator.as_str());
                output.push_str(",\"right\":");
                write_operand(output, *right);
                output.push('}');
            }
            Self::Not(query) => {
                output.push_str("{\"kind\":\"not\",\"query\":");
                query.write_json(output);
                output.push('}');
            }
        }
    }
}

/// Appends a query list serialized like `JSON.stringify(queries)`.
pub fn write_queries(output: &mut String, queries: &[Query]) {
    output.push('[');

    for (index, query) in queries.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        query.write_json(output);
    }

    output.push(']');
}

fn write_operand(output: &mut String, operand: Operand) {
    match operand {
        Operand::Height => output.push_str("\"height\""),
        Operand::Number(value) if value.is_finite() => js::write_number(output, value),
        Operand::Number(_) => output.push_str("null"),
        Operand::Width => output.push_str("\"width\""),
    }
}
