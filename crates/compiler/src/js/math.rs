//! `Math.sin`, `Math.cos`, and `Math.tan` exactly as V8 computes them.
//!
//! V8 implements these functions with fdlibm rather than the platform's libm, so their results do
//! not depend on the host. This is a line-for-line port of V8's `src/base/ieee754.cc`
//! (V8 12.4), which carries the following notice:
//!
//! ```text
//! Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//!
//! Developed at SunSoft, a Sun Microsystems, Inc. business.
//! Permission to use, copy, modify, and distribute this
//! software is freely granted, provided that this notice
//! is preserved.
//! ```
//!
//! Integer conversions follow the C casts of the original: `as i32` truncates toward zero for the
//! in-range values these kernels produce.

#![expect(
    clippy::approx_constant,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_sign_loss,
    clippy::eq_op,
    clippy::many_single_char_names,
    clippy::unreadable_literal,
    clippy::excessive_precision,
    reason = "The port keeps fdlibm's casts, names, constant spellings, and `x - x` NaN results."
)]

/// `Math.sin(x)`.
pub fn sin(x: f64) -> f64 {
    let ix = high(x) & 0x7FFF_FFFF;

    if ix <= 0x3FE9_21FB {
        return kernel_sin(x, 0.0, false);
    }

    if ix >= 0x7FF0_0000 {
        return x - x;
    }

    let (n, y0, y1) = rem_pio2(x);

    match n & 3 {
        0 => kernel_sin(y0, y1, true),
        1 => kernel_cos(y0, y1),
        2 => -kernel_sin(y0, y1, true),
        _ => -kernel_cos(y0, y1),
    }
}

/// `Math.cos(x)`.
pub fn cos(x: f64) -> f64 {
    let ix = high(x) & 0x7FFF_FFFF;

    if ix <= 0x3FE9_21FB {
        return kernel_cos(x, 0.0);
    }

    if ix >= 0x7FF0_0000 {
        return x - x;
    }

    let (n, y0, y1) = rem_pio2(x);

    match n & 3 {
        0 => kernel_cos(y0, y1),
        1 => -kernel_sin(y0, y1, true),
        2 => -kernel_cos(y0, y1),
        _ => kernel_sin(y0, y1, true),
    }
}

/// `Math.tan(x)`.
pub fn tan(x: f64) -> f64 {
    let ix = high(x) & 0x7FFF_FFFF;

    if ix <= 0x3FE9_21FB {
        return kernel_tan(x, 0.0, 1);
    }

    if ix >= 0x7FF0_0000 {
        return x - x;
    }

    let (n, y0, y1) = rem_pio2(x);

    // 1 for an even quadrant, -1 for an odd one.
    kernel_tan(y0, y1, 1 - ((n & 1) << 1))
}

/// The more significant 32 bits, as a C `int32_t`.
fn high(x: f64) -> i32 {
    (x.to_bits() >> 32) as u32 as i32
}

/// The less significant 32 bits.
fn low(x: f64) -> u32 {
    x.to_bits() as u32
}

fn insert(high: i32, low: u32) -> f64 {
    f64::from_bits((u64::from(high as u32) << 32) | u64::from(low))
}

fn with_high(x: f64, high: i32) -> f64 {
    insert(high, low(x))
}

fn with_low(x: f64, low: u32) -> f64 {
    insert(self::high(x), low)
}

/// `scalbn(x, n)`: multiplies by `2^n` exactly, as C does.
fn scalbn(x: f64, mut n: i32) -> f64 {
    let mut y = x;

    if n > 1023 {
        y *= f64::from_bits(0x7FE0_0000_0000_0000);
        n -= 1023;

        if n > 1023 {
            y *= f64::from_bits(0x7FE0_0000_0000_0000);
            n -= 1023;
            n = n.min(1023);
        }
    } else if n < -1022 {
        // 2^-1022 * 2^53 keeps intermediate results normal.
        let scale = f64::from_bits(0x0010_0000_0000_0000) * f64::from_bits(0x4340_0000_0000_0000);

        y *= scale;
        n += 1022 - 53;

        if n < -1022 {
            y *= scale;
            n += 1022 - 53;
            n = n.max(-1022);
        }
    }

    y * f64::from_bits(((0x3FF + n) as u64) << 52)
}

/// Returns the remainder of `x` rem pi/2 as `y0 + y1` with the quadrant.
fn rem_pio2(x: f64) -> (i32, f64, f64) {
    const TWO_OVER_PI: [i32; 66] = [
        0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62, 0x95993C, 0x439041, 0xFE5163,
        0xABDEBB, 0xC561B7, 0x246E3A, 0x424DD2, 0xE00649, 0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129,
        0xA73EE8, 0x8235F5, 0x2EBB44, 0x84E99C, 0x7026B4, 0x5F7E41, 0x3991D6, 0x398353, 0x39F49C,
        0x845F8B, 0xBDF928, 0x3B1FF8, 0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D, 0x367ECF,
        0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D, 0x7527BA, 0xC7EBE5, 0xF17B3D, 0x0739F7, 0x8A5292,
        0xEA6BFB, 0x5FB11F, 0x8D5D08, 0x560330, 0x46FC7B, 0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3,
        0x91615E, 0xE61B08, 0x659985, 0x5F14A0, 0x68408D, 0xFFD880, 0x4D7327, 0x310606, 0x1556CA,
        0x73A8C9, 0x60E27B, 0xC08C6B,
    ];
    const NPIO2_HW: [i32; 32] = [
        0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB,
        0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB,
        0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C,
        0x4041475C, 0x4042106C, 0x4042D97C, 0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB,
        0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB,
    ];
    const HALF: f64 = 5.00000000000000000000e-01;
    const TWO24: f64 = 1.67772160000000000000e+07;
    const INVPIO2: f64 = 6.36619772367581382433e-01;
    const PIO2_1: f64 = 1.57079632673412561417e+00;
    const PIO2_1T: f64 = 6.07710050650619224932e-11;
    const PIO2_2: f64 = 6.07710050630396597660e-11;
    const PIO2_2T: f64 = 2.02226624879595063154e-21;
    const PIO2_3: f64 = 2.02226624871116645580e-21;
    const PIO2_3T: f64 = 8.47842766036889956997e-32;

    let hx = high(x);
    let ix = hx & 0x7FFF_FFFF;

    // |x| ~<= pi/4: no reduction.
    if ix <= 0x3FE9_21FB {
        return (0, x, 0.0);
    }

    // |x| < 3pi/4: n = +-1.
    if ix < 0x4002_D97C {
        if hx > 0 {
            let mut z = x - PIO2_1;

            if ix == 0x3FF9_21FB {
                // Near pi/2, use 33+33+53 bits of pi.
                z -= PIO2_2;
                let y0 = z - PIO2_2T;

                return (1, y0, (z - y0) - PIO2_2T);
            }

            let y0 = z - PIO2_1T;

            return (1, y0, (z - y0) - PIO2_1T);
        }

        let mut z = x + PIO2_1;

        if ix == 0x3FF9_21FB {
            z += PIO2_2;
            let y0 = z + PIO2_2T;

            return (-1, y0, (z - y0) + PIO2_2T);
        }

        let y0 = z + PIO2_1T;

        return (-1, y0, (z - y0) + PIO2_1T);
    }

    // |x| ~<= 2^19 * (pi/2): medium size.
    if ix <= 0x4139_21FB {
        let mut t = x.abs();
        let n = (t * INVPIO2 + HALF) as i32;
        let fn_ = f64::from(n);
        let mut r = t - fn_ * PIO2_1;
        // First round, good to 85 bits.
        let mut w = fn_ * PIO2_1T;
        let mut y0;

        if n < 32 && Some(&ix) != NPIO2_HW.get((n - 1) as usize) {
            // Quick check: no cancellation.
            y0 = r - w;
        } else {
            let j = ix >> 20;

            y0 = r - w;

            let mut i = j - ((high(y0) >> 20) & 0x7FF);

            if i > 16 {
                // Second iteration, good to 118 bits.
                t = r;
                w = fn_ * PIO2_2;
                r = t - w;
                w = fn_ * PIO2_2T - ((t - r) - w);
                y0 = r - w;
                i = j - ((high(y0) >> 20) & 0x7FF);

                if i > 49 {
                    // Third iteration, 151 bits, covers every case.
                    t = r;
                    w = fn_ * PIO2_3;
                    r = t - w;
                    w = fn_ * PIO2_3T - ((t - r) - w);
                    y0 = r - w;
                }
            }
        }

        let y1 = (r - y0) - w;

        if hx < 0 {
            return (-n, -y0, -y1);
        }

        return (n, y0, y1);
    }

    // Infinity and NaN.
    if ix >= 0x7FF0_0000 {
        let y = x - x;

        return (0, y, y);
    }

    // z = scalbn(|x|, ilogb(x) - 23).
    let mut z = with_low(0.0, low(x));
    let e0 = (ix >> 20) - 1046;

    z = with_high(z, ix - ((e0 as u32) << 20) as i32);

    let mut tx = [0.0; 3];

    for entry in tx.iter_mut().take(2) {
        *entry = f64::from(z as i32);
        z = (z - *entry) * TWO24;
    }

    tx[2] = z;

    let mut nx = 3;

    // Skip zero terms.
    while nx > 1 && tx[nx - 1] == 0.0 {
        nx -= 1;
    }

    let (n, y0, y1) = kernel_rem_pio2(&tx[..nx], e0, &TWO_OVER_PI);

    if hx < 0 {
        return (-n, -y0, -y1);
    }

    (n, y0, y1)
}

/// `__kernel_rem_pio2(x, y, e0, nx, 2, ipio2)`: returns the last three bits of N with
/// `y = x - N * pi/2`, at the 64-bit precision fdlibm uses for doubles.
fn kernel_rem_pio2(x: &[f64], e0: i32, ipio2: &[i32]) -> (i32, f64, f64) {
    const PIO2: [f64; 8] = [
        1.57079625129699707031e+00,
        7.54978941586159635335e-08,
        5.39030252995776476554e-15,
        3.28200341580791294123e-22,
        1.27065575308067607349e-29,
        1.22933308981111328932e-36,
        2.73370053816464559624e-44,
        2.16741683877804819444e-51,
    ];
    const TWO24: f64 = 1.67772160000000000000e+07;
    const TWON24: f64 = 5.96046447753906250000e-08;

    // Precision 2 starts with four terms of 2/pi.
    let jk: i32 = 4;
    let jp = jk;
    let jx = x.len() as i32 - 1;
    let jv = ((e0 - 3) / 24).max(0);
    let mut q0 = e0 - 24 * (jv + 1);
    let mut f = [0.0; 20];
    let mut q = [0.0; 20];
    let mut fq = [0.0; 20];
    let mut iq = [0_i32; 20];
    let get = |values: &[f64; 20], index: i32| values.get(index as usize).copied().unwrap_or(0.0);
    let pio = |index: i32| ipio2.get(index as usize).copied().unwrap_or(0);
    let input = |index: i32| x.get(index as usize).copied().unwrap_or(0.0);

    // f[0..=jx+jk] holds ipio2[jv-jx..=jv+jk].
    for (i, j) in (0..=(jx + jk)).zip(jv - jx..) {
        f[i as usize] = if j < 0 { 0.0 } else { f64::from(pio(j)) };
    }

    for i in 0..=jk {
        let mut fw = 0.0;

        for j in 0..=jx {
            fw += input(j) * get(&f, jx + i - j);
        }

        q[i as usize] = fw;
    }

    let mut jz = jk;
    let mut z;
    let mut n;
    let mut ih;

    loop {
        // Distill q[] into iq[] in reverse.
        z = get(&q, jz);

        let mut i = 0;
        let mut j = jz;

        while j > 0 {
            let fw = f64::from((TWON24 * z) as i32);

            iq[i as usize] = (z - TWO24 * fw) as i32;
            z = get(&q, j - 1) + fw;
            i += 1;
            j -= 1;
        }

        // Compute n.
        z = scalbn(z, q0);
        z -= 8.0 * (z * 0.125).floor();
        n = z as i32;
        z -= f64::from(n);
        ih = 0;

        let last = (jz - 1) as usize;

        if q0 > 0 {
            // iq[jz-1] determines n.
            let i = iq[last] >> (24 - q0);

            n += i;
            iq[last] -= i << (24 - q0);
            ih = iq[last] >> (23 - q0);
        } else if q0 == 0 {
            ih = iq[last] >> 23;
        } else if z >= 0.5 {
            ih = 2;
        }

        if ih > 0 {
            // q > 0.5.
            n += 1;

            let mut carry = 0;

            for entry in iq.iter_mut().take(jz as usize) {
                let j = *entry;

                if carry == 0 {
                    if j != 0 {
                        carry = 1;
                        *entry = 0x0100_0000 - j;
                    }
                } else {
                    *entry = 0x00FF_FFFF - j;
                }
            }

            if q0 > 0 {
                // Rare case: about one in twelve.
                match q0 {
                    1 => iq[last] &= 0x007F_FFFF,
                    2 => iq[last] &= 0x003F_FFFF,
                    _ => {}
                }
            }

            if ih == 2 {
                z = 1.0 - z;

                if carry != 0 {
                    z -= scalbn(1.0, q0);
                }
            }
        }

        // Check whether recomputation is needed.
        if z == 0.0 {
            let mut j = 0;
            let mut i = jz - 1;

            while i >= jk {
                j |= iq[i as usize];
                i -= 1;
            }

            if j == 0 {
                let mut k = 1;

                while jk >= k && iq[(jk - k) as usize] == 0 {
                    k += 1;
                }

                for i in (jz + 1)..=(jz + k) {
                    f[(jx + i) as usize] = f64::from(pio(jv + i));

                    let mut fw = 0.0;

                    for j in 0..=jx {
                        fw += input(j) * get(&f, jx + i - j);
                    }

                    q[i as usize] = fw;
                }

                jz += k;
                continue;
            }
        }

        break;
    }

    // Chop off zero terms.
    if z == 0.0 {
        jz -= 1;
        q0 -= 24;

        while iq[jz as usize] == 0 {
            jz -= 1;
            q0 -= 24;
        }
    } else {
        // Break z into 24-bit chunks if necessary.
        z = scalbn(z, -q0);

        if z >= TWO24 {
            let fw = f64::from((TWON24 * z) as i32);

            iq[jz as usize] = (z - TWO24 * fw) as i32;
            jz += 1;
            q0 += 24;
            iq[jz as usize] = fw as i32;
        } else {
            iq[jz as usize] = z as i32;
        }
    }

    // Convert integer chunks to floating-point values.
    let mut fw = scalbn(1.0, q0);
    let mut i = jz;

    while i >= 0 {
        q[i as usize] = fw * f64::from(iq[i as usize]);
        fw *= TWON24;
        i -= 1;
    }

    // fq = PIO2[0..=jp] * q[jz..=0].
    let mut i = jz;

    while i >= 0 {
        let mut fw = 0.0;
        let mut k = 0;

        while k <= jp && k <= jz - i {
            fw += PIO2[k as usize] * q[(i + k) as usize];
            k += 1;
        }

        fq[(jz - i) as usize] = fw;
        i -= 1;
    }

    // Compress fq[] into y0 and y1.
    let mut fw = 0.0;
    let mut i = jz;

    while i >= 0 {
        fw += fq[i as usize];
        i -= 1;
    }

    let y0 = if ih == 0 { fw } else { -fw };

    fw = fq[0] - fw;

    for i in 1..=jz {
        fw += fq[i as usize];
    }

    let y1 = if ih == 0 { fw } else { -fw };

    (n & 7, y0, y1)
}

/// `__kernel_cos(x, y)` on [-pi/4, pi/4], where `y` is the tail of `x`.
fn kernel_cos(x: f64, y: f64) -> f64 {
    const ONE: f64 = 1.00000000000000000000e+00;
    const C1: f64 = 4.16666666666666019037e-02;
    const C2: f64 = -1.38888888888741095749e-03;
    const C3: f64 = 2.48015872894767294178e-05;
    const C4: f64 = -2.75573143513906633035e-07;
    const C5: f64 = 2.08757232129817482790e-09;
    const C6: f64 = -1.13596475577881948265e-11;

    let ix = high(x) & 0x7FFF_FFFF;

    if ix < 0x3E40_0000 && x as i32 == 0 {
        return ONE;
    }

    let z = x * x;
    let r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));

    if ix < 0x3FD3_3333 {
        return ONE - (0.5 * z - (z * r - x * y));
    }

    let qx = if ix > 0x3FE9_0000 {
        0.28125
    } else {
        insert(ix - 0x0020_0000, 0)
    };
    let iz = 0.5 * z - qx;
    let a = ONE - qx;

    a - (iz - (z * r - x * y))
}

/// `__kernel_sin(x, y, iy)` on [-pi/4, pi/4], where `y` is the tail of `x` when `tail` is set.
fn kernel_sin(x: f64, y: f64, tail: bool) -> f64 {
    const HALF: f64 = 5.00000000000000000000e-01;
    const S1: f64 = -1.66666666666666324348e-01;
    const S2: f64 = 8.33333333332248946124e-03;
    const S3: f64 = -1.98412698298579493134e-04;
    const S4: f64 = 2.75573137070700676789e-06;
    const S5: f64 = -2.50507602534068634195e-08;
    const S6: f64 = 1.58969099521155010221e-10;

    let ix = high(x) & 0x7FFF_FFFF;

    if ix < 0x3E40_0000 && x as i32 == 0 {
        return x;
    }

    let z = x * x;
    let v = z * x;
    let r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));

    if tail {
        x - ((z * (HALF * y - v * r) - y) - v * S1)
    } else {
        x + v * (S1 + z * r)
    }
}

/// `__kernel_tan(x, y, iy)` on [-pi/4, pi/4]: `tan` when `iy` is 1 and `-1/tan` when it is -1.
fn kernel_tan(mut x: f64, mut y: f64, iy: i32) -> f64 {
    const T: [f64; 13] = [
        3.33333333333334091986e-01,
        1.33333333333201242699e-01,
        5.39682539762260521377e-02,
        2.18694882948595424599e-02,
        8.86323982359930005737e-03,
        3.59207910759131235356e-03,
        1.45620945432529025516e-03,
        5.88041240820264096874e-04,
        2.46463134818469906812e-04,
        7.81794442939557092300e-05,
        7.14072491382608190305e-05,
        -1.85586374855275456654e-05,
        2.59073051863633712884e-05,
    ];
    const ONE: f64 = 1.00000000000000000000e+00;
    const PIO4: f64 = 7.85398163397448278999e-01;
    const PIO4LO: f64 = 3.06161699786838301793e-17;

    let hx = high(x);
    let ix = hx & 0x7FFF_FFFF;

    // |x| < 2^-28.
    if ix < 0x3E30_0000 && x as i32 == 0 {
        if ((ix as u32 | low(x)) | (iy + 1) as u32) == 0 {
            return ONE / x.abs();
        }

        if iy == 1 {
            return x;
        }

        // -1 / (x + y), computed carefully.
        let w = x + y;
        let z = with_low(w, 0);
        let v = y - (z - x);
        let a = -ONE / w;
        let t = with_low(a, 0);
        let s = ONE + t * z;

        return t + a * (s + t * v);
    }

    // |x| >= 0.6744.
    let large = ix >= 0x3FE5_9428;

    if large {
        if hx < 0 {
            x = -x;
            y = -y;
        }

        let z = PIO4 - x;
        let w = PIO4LO - y;

        x = z + w;
        y = 0.0;
    }

    let z = x * x;
    let w = z * z;
    // x^5 * (T[1] + x^4 * T[3] + ... + x^20 * T[11]) + x^5 * (x^2 * (T[2] + ... + x^22 * T[12])).
    let mut r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
    let v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
    let s = z * x;

    r = y + z * (s * (r + v) + y);
    r += T[0] * s;

    let w = x + r;

    if large {
        let v = f64::from(iy);
        let sign = f64::from(1 - ((hx >> 30) & 2));

        return sign * (v - 2.0 * (x - (w * w / (w + v) - r)));
    }

    if iy == 1 {
        return w;
    }

    // -1.0 / (x + r), computed accurately.
    let z = with_low(w, 0);
    let v = r - (z - x);
    let a = -1.0 / w;
    let t = with_low(a, 0);
    let s = 1.0 + t * z;

    t + a * (s + t * v)
}
