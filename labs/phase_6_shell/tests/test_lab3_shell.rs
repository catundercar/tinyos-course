//! Lab 3 — shell parser & pipeline orchestration

#[test]
fn parse_single_command() {
    // "ls" → [Command{argv:["ls"]}], background=false
}

#[test]
fn parse_pipeline_two_stages() {
    // "ls | wc -l" → two Commands, wc has argv ["wc","-l"]
}

#[test]
fn parse_redirection_in() {
    // "cat < file" → stdin_file = Some("file"), argv = ["cat"]
}

#[test]
fn parse_redirection_out() {
    // "echo hi > out" → stdout_file = Some("out"), argv = ["echo","hi"]
}

#[test]
fn parse_background() {
    // "sleep 5 &" → background = true
}

#[test]
fn parse_three_stage_pipeline() {
    // "cat f | grep foo | wc -l" → exactly 3 Commands
}

#[test]
fn run_pipeline_ls_wc_produces_count() {
    // End-to-end: stub an `ls` that prints 3 names, pipe into `wc -l`,
    // capture fd 1 of the pipeline, expect "3\n".
}
