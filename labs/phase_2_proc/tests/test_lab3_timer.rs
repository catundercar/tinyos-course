//! test_lab3_timer.rs — Host-side tests for Lab 3 (timer math).

const CLOCK_FREQ: usize = 10_000_000;
const TICKS_PER_SEC: usize = 100;
const MSEC_PER_SEC: usize = 1000;

fn next_trigger(now: usize) -> usize { now + CLOCK_FREQ / TICKS_PER_SEC }
fn get_time_ms(raw: usize) -> usize { raw / (CLOCK_FREQ / MSEC_PER_SEC) }

#[test]
fn ten_millisecond_slice() {
    assert_eq!(CLOCK_FREQ / TICKS_PER_SEC, 100_000);
}

#[test]
fn trigger_is_absolute_not_relative() {
    // Key invariant: set_timer takes an absolute mtimecmp value.
    let now = 1_234_567;
    let n1 = next_trigger(now);
    assert!(n1 > now, "next trigger must be in the future");
    assert_eq!(n1 - now, 100_000);
}

#[test]
fn time_ms_conversion_roundtrips() {
    assert_eq!(get_time_ms(10_000_000), 1000);
    assert_eq!(get_time_ms(0), 0);
    assert_eq!(get_time_ms(100_000), 10);
}
