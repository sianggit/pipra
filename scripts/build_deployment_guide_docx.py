"""
Build Comprehensive Deployment Guide & Target Server Runbook (.docx)
Product: Pipra - Pipeline & Release Engineering Platform
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOT_DIR = os.path.join(BASE_DIR, "docs", "screenshot")
ASSETS_DIR = os.path.join(BASE_DIR, "public", "assets")
OUTPUT_DOCX = os.path.join(BASE_DIR, "docs", "Pipra_Target_Server_Deployment_Guide.docx")

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_callout_border(cell, color_hex="2563EB", sz="24"):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color_hex}"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>')
    tcPr.append(borders)

def add_callout(doc, text, title="OPERATIONAL NOTE", color="2563EB", bg_color="F1F5F9"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg_color)
    set_callout_border(cell, color, sz="24")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=180)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run_t = p.add_run(f"[{title}] ")
    run_t.bold = True
    run_t.font.size = Pt(9.5)
    run_t.font.name = "Segoe UI"
    if color == "BE123C":
        run_t.font.color.rgb = RGBColor(190, 18, 60)
    elif color == "B45309":
        run_t.font.color.rgb = RGBColor(180, 83, 9)
    else:
        run_t.font.color.rgb = RGBColor(37, 99, 235)
    
    run_b = p.add_run(text)
    run_b.font.size = Pt(9.5)
    run_b.font.name = "Segoe UI"
    run_b.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_figure(doc, image_filename, caption_text, width_inches=6.2):
    img_path = os.path.join(SCREENSHOT_DIR, image_filename)
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(3)
        run = p_img.add_run()
        run.add_picture(img_path, width=Inches(width_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(12)
        r_cap = p_cap.add_run(caption_text)
        r_cap.italic = True
        r_cap.font.size = Pt(8.5)
        r_cap.font.name = "Segoe UI"
        r_cap.font.color.rgb = RGBColor(100, 116, 139)
    else:
        p = doc.add_paragraph(f"[Image not found: {image_filename}]")
        p.paragraph_format.space_after = Pt(8)

def format_table(table, col_widths, headers, data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Header Row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].width = Inches(col_widths[i])
        set_cell_background(hdr_cells[i], "1E293B")
        set_cell_margins(hdr_cells[i], top=100, bottom=100, left=120, right=120)
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(title)
        run.bold = True
        run.font.name = "Segoe UI"
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
    
    # Data Rows
    for r_idx, row_data in enumerate(data):
        row_cells = table.add_row().cells
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        for c_idx, val in enumerate(row_data):
            row_cells[c_idx].width = Inches(col_widths[c_idx])
            set_cell_background(row_cells[c_idx], bg)
            set_cell_margins(row_cells[c_idx], top=80, bottom=80, left=120, right=120)
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(str(val))
            run.font.name = "Segoe UI"
            run.font.size = Pt(8.5)
            run.font.color.rgb = RGBColor(30, 41, 59)

def build_deployment_guide():
    doc = Document()
    
    # Configure Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)
    normal_style.paragraph_format.line_spacing = 1.2
    normal_style.paragraph_format.space_after = Pt(6)
    
    # Configure Page Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        
        # Configure Header & Footer
        header = section.header
        p_hdr = header.paragraphs[0]
        p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_hdr = p_hdr.add_run("Pipra Control Plane — Target Server Deployment Guide v1.0")
        r_hdr.font.name = "Segoe UI"
        r_hdr.font.size = Pt(8)
        r_hdr.font.color.rgb = RGBColor(148, 163, 184)
        
        footer = section.footer
        p_ftr = footer.paragraphs[0]
        p_ftr.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_ftr_l = p_ftr.add_run("Build with confidence. Ship with control.  |  ASYST Platform Engineering")
        r_ftr_l.font.name = "Segoe UI"
        r_ftr_l.font.size = Pt(8)
        r_ftr_l.font.color.rgb = RGBColor(148, 163, 184)

    # ==========================================
    # COVER / HEADER BLOCK
    # ==========================================
    p_logo = doc.add_paragraph()
    p_logo.paragraph_format.space_before = Pt(10)
    p_logo.paragraph_format.space_after = Pt(6)
    bird_path = os.path.join(ASSETS_DIR, "pipra-bird.png")
    if os.path.exists(bird_path):
        p_logo.add_run().add_picture(bird_path, width=Inches(0.65))

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("Pipra — Target Server Deployment Guide")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(22)
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("Step-by-Step Operator Runbook for Zero-Downtime Blue-Green Releases, Live Fleet Telemetry, and Automated Rollback Recovery")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Document Metadata Summary Card
    meta_tbl = doc.add_table(rows=1, cols=4)
    format_table(meta_tbl, [1.6, 1.6, 1.6, 1.7], 
                 ["Document ID", "Target System", "Security Level", "Release Engine"],
                 [["DOC-PIPRA-DEPLOY-v1.0", "Linux x86_64 / Docker", "RBAC Enforced (Op/Admin)", "10-Stage State Machine"]])
    
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ==========================================
    # SECTION 1: EXECUTIVE ARCHITECTURE OVERVIEW
    # ==========================================
    h1_1 = doc.add_heading("1. Executive Overview & Deployment Architecture", level=1)
    h1_1.paragraph_format.space_before = Pt(14)
    h1_1.paragraph_format.space_after = Pt(6)
    for r in h1_1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    p = doc.add_paragraph(
        "Pipra is a high-reliability, self-hosted deployment orchestration platform designed for release engineering "
        "and production operations. It replaces fragile manual shell deployments (such as legacy deploy_asdp-dims-fe.sh scripts) "
        "with a deterministic, auditable 10-stage execution state machine featuring automated staging verification and sub-second atomic cutover."
    )
    
    p2 = doc.add_paragraph(
        "The core architectural pattern implemented by Pipra is an isolated Blue-Green staging barrier: candidate releases "
        "are compiled into immutable container artifacts, booted on an isolated staging port (:4001), and subjected to real HTTP "
        "synthetic health probes. Live production traffic on port :4000 is never touched until the candidate proves 100% operational."
    )

    add_callout(
        doc,
        "Zero-Downtime Guarantee: Pipra never stops or interrupts an active production container during build or staging. "
        "If a build fails or staging health checks time out, the candidate container is cleanly terminated with zero impact on serving traffic.",
        title="CORE SAFETY PRINCIPLE",
        color="2563EB",
        bg_color="EFF6FF"
    )

    # 10 Stages Summary Table
    stages_tbl = doc.add_table(rows=1, cols=4)
    stages_data = [
        ["Stage 1: Preflight", "Validates RBAC permissions, git ref, Docker daemon status, target ports, and concurrency locks.", "Zero external side-effects; rejects invalid requests immediately."],
        ["Stage 2: Source Sync", "Executes git fetch and checkouts the immutable revision; records SHA, commit message, and author.", "Ensures exact git provenance and reproducibility."],
        ["Stage 3: Local Verify", "Optional pre-build verification (npm ci / npm run build). Skipped by default.", "Prevents redundant compilation when multi-stage Docker is active."],
        ["Stage 4: Docker Build", "Compiles production container image with BuildKit caching; captures size & duration.", "Masks sensitive build arguments and redacts credentials from logs."],
        ["Stage 5: Staging Startup", "Launches candidate container on isolated host port (:4001).", "Existing live container on :4000 continues serving without interruption."],
        ["Stage 6: Health Verify", "Executes automated HTTP synthetic probes (GET /) against :4001 with retry loop.", "Barrier gate: Deployment will NOT proceed if staging fails verification."],
        ["Stage 7: Atomic Cutover", "Performs atomic container swap: renames live to backup, binds candidate to :4000.", "Sub-second transition with state preservation."],
        ["Stage 8: Prod Verify", "Probes live route at http://127.0.0.1:4000/ to confirm live traffic service.", "If probes fail, triggers automated sub-second rollback (Stage 9)."],
        ["Stage 9: Auto Rollback", "Restores pre-cutover backup container and rebinds live production traffic.", "Automated fail-safe that restores previous known-good release."],
        ["Stage 10: Finalization", "Cleans up staging artifacts/backups, updates SQLite registry, emits audit log.", "Marks deployment as SUCCEEDED and updates fleet status."]
    ]
    format_table(stages_tbl, [1.4, 2.8, 2.3], ["Stage & Identifier", "Automated Execution Routine", "Safety Gate / Guarantee"], stages_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ==========================================
    # SECTION 2: TARGET SERVER PRE-REQUISITES
    # ==========================================
    h1_2 = doc.add_heading("2. Prerequisites & Target Server Topology", level=1)
    h1_2.paragraph_format.space_before = Pt(14)
    h1_2.paragraph_format.space_after = Pt(6)
    for r in h1_2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "Before triggering releases, operators must verify that target environments and agent host daemons are online. "
        "Pipra segregates environments by risk tier, enforcing strict confirmation barriers and rollback mandates on production."
    )

    # Environment Table
    env_tbl = doc.add_table(rows=1, cols=4)
    env_data = [
        ["Development", "10.200.45.10 / local", ":4000 (app)", "Non-production cluster. Rapid iteration, hotfix testing."],
        ["Staging / QA", "127.0.0.1 / host", ":4001 (isolated)", "Staging validation barrier. Mandatory pre-cutover health check."],
        ["Production", "172.25.207.222", ":4000 (live)", "Production critical. Requires Operator confirmation & automated rollback."]
    ]
    format_table(env_tbl, [1.4, 1.6, 1.4, 2.1], ["Environment", "Host IP / Target", "Port Mapping", "Risk Tier & Safeguard Policy"], env_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    add_figure(doc, "04_environments_dark.png", "Figure 1: Target Environments Configuration & Production Critical Safeguards")

    doc.add_paragraph(
        "Each target environment maintains explicit safeguards: operator confirmation barriers, target concurrency locks "
        "(preventing overlapping deployments), and automated sub-second rollbacks. If an environment reports disconnected or stale, "
        "inspect the Execution Agents console."
    )

    add_figure(doc, "08_infrastructure_dark.png", "Figure 2: Execution Agents Telemetry & Docker Host Capacity")

    # ==========================================
    # SECTION 3: STEP-BY-STEP DEPLOYMENT RUNBOOK
    # ==========================================
    h1_3 = doc.add_heading("3. Step-by-Step Deployment Walkthrough", level=1)
    h1_3.paragraph_format.space_before = Pt(14)
    h1_3.paragraph_format.space_after = Pt(6)
    for r in h1_3.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    # Step 3.1
    h2_1 = doc.add_heading("Step 3.1: Sign In to Pipra Control Plane", level=2)
    h2_1.paragraph_format.space_before = Pt(8)
    h2_1.paragraph_format.space_after = Pt(4)
    for r in h2_1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(37, 99, 235)
        r.font.size = Pt(12)

    doc.add_paragraph(
        "1. Open your web browser and navigate to the Pipra Control Plane at http://<pipra-host>:4200 (or http://localhost:4200).\n"
        "2. In the Operator username field, enter your authorized account username (e.g. operator or admin).\n"
        "3. Enter your account password. For sandbox and prototype sessions, the prototype account chips at the bottom "
        "can be clicked to automatically populate verified test credentials (admin / pipra-admin-2026, operator / pipra-ops-2026).\n"
        "4. Click 'Sign in to control plane'."
    )

    add_figure(doc, "01_login_dark.png", "Figure 3: Pipra Control Plane Sign-in Screen & Prototype Accounts Picker")

    add_callout(
        doc,
        "Role-Based Access Control (RBAC): The 'viewer' account has read-only access and cannot launch deployments. "
        "Triggering pipeline releases requires 'operator' or 'admin' privileges. Production host settings require 'admin'.",
        title="PERMISSION REQUIREMENT",
        color="2563EB",
        bg_color="EFF6FF"
    )

    # Step 3.2
    h2_2 = doc.add_heading("Step 3.2: Inspect Fleet Health on the Operations Cockpit", level=2)
    h2_2.paragraph_format.space_before = Pt(12)
    h2_2.paragraph_format.space_after = Pt(4)
    for r in h2_2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(37, 99, 235)
        r.font.size = Pt(12)

    doc.add_paragraph(
        "Upon authentication, Pipra opens the Release Operations cockpit. Before launching any new deployment:\n"
        "1. Check the 4-cell metric strip: Verify active pipeline count (engine idle vs busy) and historical verified rate.\n"
        "2. Review the 'Needs attention' alert panel: If previous production runs failed, inspect diagnostics to understand whether a rollback is currently serving.\n"
        "3. Inspect the 'Serving now' promotion rail: Ensure that upstream environments (Development, Staging) report Healthy status before deploying to Production."
    )

    add_figure(doc, "02_overview_dark.png", "Figure 4: Release Operations Cockpit, Promotion Rail & Live Health States")

    doc.add_paragraph(
        "4. To inspect the application repository configuration, Dockerfile source, or health probe policies, "
        "open the Applications tab from the primary navigation bar."
    )

    add_figure(doc, "03_applications_dark.png", "Figure 5: Applications Registry & Health Policy Configuration")

    # Step 3.3
    h2_3 = doc.add_heading("Step 3.3: Configure & Launch the Deployment Wizard", level=2)
    h2_3.paragraph_format.space_before = Pt(12)
    h2_3.paragraph_format.space_after = Pt(4)
    for r in h2_3.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(37, 99, 235)
        r.font.size = Pt(12)

    doc.add_paragraph(
        "To initiate a deployment, click the 'Deploy' tab in the top navigation or click 'Start deployment' from the Cockpit. "
        "The Deployment Wizard guides the operator through a safe 3-stage validation workflow:"
    )

    doc.add_paragraph(
        "• Stage 1 (Target): Select the deployable application (e.g. ASDP DIMS Frontend) and choose the Target Environment "
        "(Development, Staging, or Production). Non-production targets allow immediate progression, while Production activates high-risk indicators.\n"
        "• Stage 2 (Revision & Image): Enter the Branch / tag / ref (permitted refs: develop, main, prod, staging, release/*, hotfix/*). "
        "Provide an immutable Image tag (e.g. v1.0.10-b3021) and confirm container name.\n"
        "• Stage 3 (Preflight & Cutover): Pipra runs automated preflight checks on target host ports (:4000, :4001) and records "
        "the current rollback candidate release. When deploying to Production, the operator MUST check the explicit confirmation box: "
        "'I confirm deploying <tag> to Production'."
    )

    add_callout(
        doc,
        "Production Safeguard Barrier: When Production is selected, the submit button is styled in high-visibility danger crimson. "
        "The button remains strictly disabled until the operator acknowledges the cutover impact checkbox.",
        title="CRITICAL PRODUCTION SAFEGUARD",
        color="BE123C",
        bg_color="FFF1F2"
    )

    add_figure(doc, "05_deploy_wizard_dark.png", "Figure 6: 3-Stage Deployment Wizard & Live Preflight Summary")

    doc.add_paragraph(
        "Click 'Start deployment to <environment>' to submit the job. Pipra enqueues the release and immediately routes to the live execution view."
    )

    # Step 3.4
    h2_4 = doc.add_heading("Step 3.4: Real-Time Observability & Stage Monitoring", level=2)
    h2_4.paragraph_format.space_before = Pt(12)
    h2_4.paragraph_format.space_after = Pt(4)
    for r in h2_4.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(37, 99, 235)
        r.font.size = Pt(12)

    doc.add_paragraph(
        "The Live Deployment Detail view provides comprehensive, real-time observability as the release executes through the 10-stage engine:\n"
        "1. Pipeline Progress Bar & Stage Pills: Visual bar reflects duration and status of each stage (Passed = Green, Skipped = Gray, Failed = Red).\n"
        "2. Stage Selection: Clicking any stage button filters the Terminal Log specifically to that stage's diagnostic output.\n"
        "3. Live Terminal Log: Monospace output displaying real container build output, probe retries, container IDs, and cutover timestamps. "
        "Sensitive credentials and secret environment variables are automatically masked.\n"
        "4. Health Probes Table: Displays each HTTP probe attempt, latency in milliseconds, and pass/retry/fail outcomes.\n"
        "5. Release Verification Card: Confirms whether staging passed, production route returned HTTP 200, and backup container state is preserved."
    )

    add_figure(doc, "06_deployment_detail_dark.png", "Figure 7: Live Pipeline Execution Detail, Interactive Timeline & Health Probes Table")

    # Step 3.5
    h2_5 = doc.add_heading("Step 3.5: Post-Deployment Verification, History & Audit Logs", level=2)
    h2_5.paragraph_format.space_before = Pt(12)
    h2_5.paragraph_format.space_after = Pt(4)
    for r in h2_5.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(37, 99, 235)
        r.font.size = Pt(12)

    doc.add_paragraph(
        "Once a deployment reaches a terminal status (Verified or Failed):\n"
        "1. Deployment History: Open the Deployments tab to search past executions by deployment ID, commit SHA, branch, or environment. "
        "Filter by environment (Development, Staging, Production) or outcome status.\n"
        "2. Audit & Administration Trail: All consequential operations—including user logins, deployment submissions, cancellations, and host changes—"
        "are immutably logged in the Audit & Admin log with operator username, client IP, timestamp, and target environment."
    )

    add_figure(doc, "07_history_dark.png", "Figure 8: Deployments History with Multi-Attribute Search & Environment Filters")

    add_figure(doc, "09_admin_dark.png", "Figure 9: Immutable Audit Trail & Administrative Activity Log")

    # ==========================================
    # SECTION 4: FAILURE MODES & RECOVERY
    # ==========================================
    h1_4 = doc.add_heading("4. Operational Failure Modes & Automated Recovery", level=1)
    h1_4.paragraph_format.space_before = Pt(14)
    h1_4.paragraph_format.space_after = Pt(6)
    for r in h1_4.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "Pipra is designed around the principle of deterministic recovery: systems will experience software bugs, bad builds, "
        "and failed runtime probes, but the control plane must prevent user-facing downtime automatically."
    )

    # Failure Mode Table
    fail_tbl = doc.add_table(rows=1, cols=4)
    fail_data = [
        ["Staging Health Timeout (HTTP 000 / 502)", "Stage 6 probes fail after 15 retries.", "Staging container is killed & pruned. Production traffic is NEVER touched.", "Zero user impact. Review Stage 4/5 logs to fix application startup error."],
        ["Production Verification Failure", "Cutover succeeded, but Stage 8 live probes return error.", "Stage 9 (Auto Rollback) executes instantly: stops faulty container, restores backup container.", "Previous release is restored within ~1 second. Production remains operational."],
        ["Target Concurrency Lock (HTTP 409)", "Two operators click deploy to same target simultaneously.", "Second request is rejected immediately with HTTP 409 conflict error.", "Prevents Docker port collisions and corrupt state."],
        ["Process Crash / Host Reboot", "Pipra daemon terminates mid-deployment.", "Startup reconciliation marks orphan run as INTERRUPTED.", "Operator clicks 'Re-deploy' or restores previous known-good release."]
    ]
    format_table(fail_tbl, [1.5, 1.6, 1.8, 1.6], ["Failure Scenario", "Detection Trigger", "Automated Pipra Action", "Operator Procedure"], fail_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_callout(
        doc,
        "Rollback Assurance: When a production release fails post-cutover verification, Pipra automatically preserves "
        "and restores the pre-cutover container. The deployment record clearly indicates 'Rollback completed and the previous "
        "release is still serving', preventing false-positive panic.",
        title="AUTOMATED RECOVERY GUARANTEE",
        color="B45309",
        bg_color="FFFBEB"
    )

    # ==========================================
    # SECTION 5: OPERATOR CHECKLIST
    # ==========================================
    h1_5 = doc.add_heading("5. Operator Pre-Flight & Post-Flight Checklists", level=1)
    h1_5.paragraph_format.space_before = Pt(14)
    h1_5.paragraph_format.space_after = Pt(6)
    for r in h1_5.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph("Follow this checklist for every production deployment cycle:")

    chk_tbl = doc.add_table(rows=1, cols=3)
    chk_data = [
        ["[ ] Step 1", "Verify Agent Status", "Open Infrastructure tab; confirm target host reports 'Online' with < 80% CPU load."],
        ["[ ] Step 2", "Verify Upstream Health", "Confirm the candidate build was verified in Staging before promoting to Production."],
        ["[ ] Step 3", "Check Permitted Ref", "Ensure branch ref is standard (develop, main, release/*, hotfix/*)."],
        ["[ ] Step 4", "Unique Tagging", "Confirm image tag follows semantic versioning or build ID (e.g. v1.0.10-b3021)."],
        ["[ ] Step 5", "Acknowledge Safeguard", "Review rollback candidate in Stage 3 preflight before clicking confirmation checkbox."],
        ["[ ] Step 6", "Monitor Probes", "Observe Stage 6 and Stage 8 health probe latencies in real time."],
        ["[ ] Step 7", "Verify Serving Release", "Return to Cockpit; verify new tag is active in the 'Serving now' Promotion Rail."],
        ["[ ] Step 8", "Audit Confirmation", "Check Audit & Admin tab to verify operator action was recorded with timestamp."]
    ]
    format_table(chk_tbl, [1.0, 2.0, 3.5], ["Check", "Phase / Action", "Operational Verification Standard"], chk_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Closing Sign-off
    p_close = doc.add_paragraph()
    p_close.paragraph_format.space_before = Pt(8)
    r_c1 = p_close.add_run("Pipra Control Plane  |  ASYST Platform Engineering  |  Confidential & Proprietary\n")
    r_c1.bold = True
    r_c1.font.size = Pt(9)
    r_c1.font.color.rgb = RGBColor(71, 85, 105)
    r_c2 = p_close.add_run("For emergency platform support or on-call incident escalation, contact DevOps Release Engineering.")
    r_c2.font.size = Pt(8.5)
    r_c2.font.color.rgb = RGBColor(100, 116, 139)

    doc.save(OUTPUT_DOCX)
    print(f"Successfully generated comprehensive deployment guide DOCX at: {OUTPUT_DOCX}")

if __name__ == "__main__":
    build_deployment_guide()

