//! WebAssembly entrypoint for hosts without the native addon: browsers, workers, and Node on
//! platforms without a prebuilt binary.
//!
//! The module is a WASI reactor without threads or shared memory, so it instantiates
//! synchronously in any JavaScript engine with WebAssembly. A host writes UTF-8 input into memory
//! from [`zyzz_alloc`], calls an operation, reads the UTF-8 result at the returned packed
//! pointer and length, and releases both buffers with [`zyzz_free`].

/// Reserves `length` bytes for host input. The host releases them with [`zyzz_free`].
#[expect(
    unsafe_code,
    reason = "The host addresses exported memory through a C ABI symbol."
)]
#[unsafe(no_mangle)]
pub extern "C" fn zyzz_alloc(length: usize) -> *mut u8 {
    let mut buffer = std::mem::ManuallyDrop::new(Vec::<u8>::with_capacity(length));

    buffer.as_mut_ptr()
}

/// Releases a buffer from [`zyzz_alloc`] or an operation result.
///
/// # Safety
///
/// `pointer` and `length` must describe a buffer this module allocated and has not released.
#[expect(
    unsafe_code,
    reason = "The host returns ownership of buffers it read or filled."
)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zyzz_free(pointer: *mut u8, length: usize) {
    // SAFETY: the caller passes a buffer from `zyzz_alloc` or a result, whose capacity is `length`.
    drop(unsafe { Vec::from_raw_parts(pointer, 0, length) });
}

/// Copies a host buffer into a string and releases it.
///
/// # Safety
///
/// `pointer` and `length` must describe an initialized buffer from [`zyzz_alloc`].
#[expect(unsafe_code, reason = "Host buffers arrive as raw parts.")]
unsafe fn take(pointer: *mut u8, length: usize) -> String {
    // SAFETY: the caller passes an initialized buffer of `length` bytes.
    let text = String::from_utf8_lossy(unsafe { std::slice::from_raw_parts(pointer, length) })
        .into_owned();

    // SAFETY: the buffer came from `zyzz_alloc(length)` and is released once.
    unsafe { zyzz_free(pointer, length) };

    text
}

/// Runs the operation named by the first buffer on the UTF-8 input in the second, returning the
/// result's pointer in the high 32 bits and its length in the low 32 bits.
///
/// # Safety
///
/// Both buffers must come from [`zyzz_alloc`] and be initialized for their lengths. This
/// function takes ownership of them.
#[expect(
    unsafe_code,
    reason = "The host passes input buffers through a C ABI symbol."
)]
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zyzz_call(
    operation: *mut u8,
    operation_length: usize,
    input: *mut u8,
    input_length: usize,
) -> u64 {
    // SAFETY: the caller transfers two initialized buffers from `zyzz_alloc`.
    let (operation, input) =
        unsafe { (take(operation, operation_length), take(input, input_length)) };
    // A boxed slice has exactly its length as capacity, which `zyzz_free` relies on.
    let output = std::mem::ManuallyDrop::new(
        compiler::api::call(&operation, &input)
            .into_bytes()
            .into_boxed_slice(),
    );
    let pointer = u32::try_from(output.as_ptr().addr()).unwrap_or_default();
    let length = u32::try_from(output.len()).unwrap_or_default();

    (u64::from(pointer) << 32) | u64::from(length)
}
