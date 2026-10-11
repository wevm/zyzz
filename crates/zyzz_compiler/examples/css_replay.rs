//! Replays captured `Css.compile` calls through the Rust compiler and reports every mismatch.
//!
//! Each input line is a JSON object with the wire `input`, the TypeScript `output` encoded in
//! the wire output format, and an optional `encodeError`. Mismatches are written to the file
//! named by `--out` for inspection.

#![expect(
    clippy::print_stdout,
    clippy::disallowed_methods,
    reason = "A developer replay tool reads capture files, times stages, and prints a report."
)]

use std::collections::BTreeMap;
use std::io::{BufRead, Write as _};
use std::time::{Duration, Instant};

use serde::Deserialize;

#[derive(Deserialize)]
struct Capture {
    #[serde(default, rename = "encodeError")]
    encode_error: Option<String>,
    #[serde(default)]
    input: Option<String>,
    output: String,
}

fn category(expected: &str, actual: &str) -> &'static str {
    match (
        expected.starts_with("{\"error\""),
        actual.starts_with("{\"error\""),
    ) {
        (true, true) => "error message",
        (true, false) => "expected error, got output",
        (false, true) => "expected output, got error",
        (false, false) => "output",
    }
}

fn main() {
    let mut files = Vec::new();
    let mut out = None;
    let mut arguments = std::env::args().skip(1);

    while let Some(argument) = arguments.next() {
        if argument == "--out" {
            out = arguments.next();
        } else {
            files.push(argument);
        }
    }

    let mut report = out.map(|path| std::fs::File::create(path).expect("mismatch report"));
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    let mut decode = Duration::ZERO;
    let mut compile = Duration::ZERO;
    let mut encode = Duration::ZERO;

    for file in files {
        let reader = std::io::BufReader::new(std::fs::File::open(&file).expect("capture file"));

        for line in reader.lines() {
            let line = line.expect("capture line");
            let capture: Capture = serde_json::from_str(&line).expect("capture entry");

            *counts.entry("captured").or_default() += 1;

            let Some(input) = capture.input else {
                *counts.entry("excluded: encode failed").or_default() += 1;

                if let Some(report) = &mut report {
                    writeln!(
                        report,
                        "{}",
                        serde_json::json!({ "category": "encode", "error": capture.encode_error })
                    )
                    .expect("report");
                }

                continue;
            };
            let start = Instant::now();
            let decoded = zyzz_compiler::wire::decode(&input);
            let decoded_at = Instant::now();
            let result = decoded.and_then(|mut input| input.compile());
            let compiled_at = Instant::now();
            let actual = zyzz_compiler::wire::encode(&result);

            decode += decoded_at - start;
            compile += compiled_at - decoded_at;
            encode += compiled_at.elapsed();
            *counts.entry("compared").or_default() += 1;

            if actual == capture.output {
                *counts.entry("equal").or_default() += 1;
                continue;
            }

            let kind = category(&capture.output, &actual);

            *counts.entry(kind).or_default() += 1;

            if let Some(report) = &mut report {
                writeln!(
                    report,
                    "{}",
                    serde_json::json!({
                        "actual": actual,
                        "category": kind,
                        "expected": capture.output,
                        "input": input,
                    })
                )
                .expect("report");
            }
        }
    }

    for (name, count) in &counts {
        println!("{name}: {count}");
    }

    println!("rust time: decode {decode:?}, compile {compile:?}, encode {encode:?}");
}
