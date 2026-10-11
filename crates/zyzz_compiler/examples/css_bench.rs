//! Times wire decoding, `web::css::compile`, and wire encoding for prepared corpus inputs.
//!
//! Each argument names a JSON wire input. A sibling `<name>.expected.json` file, when present,
//! must equal the encoded output, so timings only cover verified results.

#![expect(
    clippy::print_stdout,
    clippy::disallowed_methods,
    reason = "A developer timing tool reads prepared inputs, reads the clock, and prints a report."
)]

use std::time::{Duration, Instant};

use zyzz_compiler::wire;

/// Runs a closure repeatedly and reports the median and mean durations.
fn time(mut operation: impl FnMut()) -> (Duration, Duration, usize) {
    for _ in 0..5 {
        operation();
    }

    let mut samples = Vec::new();
    let deadline = Instant::now() + Duration::from_millis(1500);

    while samples.len() < 20 || (Instant::now() < deadline && samples.len() < 2000) {
        let start = Instant::now();

        operation();
        samples.push(start.elapsed());
    }

    samples.sort();

    let total: Duration = samples.iter().sum();
    let count = u32::try_from(samples.len()).unwrap_or(u32::MAX);

    (
        samples.get(samples.len() / 2).copied().unwrap_or_default(),
        total / count,
        samples.len(),
    )
}

fn main() {
    println!("name\tdecode median\tcompile median\tencode median\ttotal median\tsamples");

    for path in std::env::args().skip(1) {
        let input = std::fs::read_to_string(&path).expect("wire input");
        let expected = std::fs::read_to_string(path.replace(".json", ".expected.json")).ok();
        let mut decoded = wire::decode(&input).expect("decoded input");
        let output = decoded.compile();
        let encoded = wire::encode(&output);

        if let Some(expected) = &expected {
            assert_eq!(
                &encoded, expected,
                "{path} differs from the TypeScript output"
            );
        }

        let (decode, _, samples) = time(|| {
            std::hint::black_box(wire::decode(&input).expect("decoded input"));
        });
        let (compile, _, _) = time(|| {
            std::hint::black_box(decoded.compile().expect("compiled"));
        });
        let (encode, _, _) = time(|| {
            std::hint::black_box(wire::encode(&output));
        });
        let (total, _, _) = time(|| {
            std::hint::black_box(wire::compile(&input));
        });
        let name = std::path::Path::new(&path)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_owned();

        println!("{name}\t{decode:?}\t{compile:?}\t{encode:?}\t{total:?}\t{samples}");
    }
}
