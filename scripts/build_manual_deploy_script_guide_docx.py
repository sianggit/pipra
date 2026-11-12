"""
Build Comprehensive ASDP DIMS-FE Manual Deployment Script Setup & Pipra User Manual (.docx)
Product: Pipra - Pipeline & Release Engineering Platform
Source Markdown: .reference/docs/installation/2026-10-31_System_Manual-Deployment-Script-Setup-And-Pipra-User-Manual_v1.0.md
"""

import os
import shutil
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOT_DIR = os.path.join(BASE_DIR, "docs", "screenshot")
ASSETS_DIR = os.path.join(BASE_DIR, "public", "assets")
OUTPUT_DOCX_CANONICAL = os.path.join(BASE_DIR, "docs", "2026-10-31_System_Manual-Deployment-Script-Setup-And-Pipra-User-Manual_v1.0.docx")
OUTPUT_DOCX_FRIENDLY = os.path.join(BASE_DIR, "docs", "Pipra_Manual_Deploy_Script_and_User_Guide.docx")

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
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
    set_cell_margins(cell, top=130, bottom=130, left=180, right=160)
    
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
        p = doc.add_paragraph(f"[Image placeholder: {image_filename}]")
        p.paragraph_format.space_after = Pt(6)

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
            set_cell_margins(row_cells[c_idx], top=70, bottom=70, left=100, right=100)
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(str(val))
            run.font.name = "Segoe UI"
            run.font.size = Pt(8.5)
            run.font.color.rgb = RGBColor(30, 41, 59)

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.1
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(226, 232, 240)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def build_docx():
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
        r_hdr = p_hdr.add_run("Pipra Platform — ASDP DIMS-FE Deployment Guide & Operational Manual")
        r_hdr.font.name = "Segoe UI"
        r_hdr.font.size = Pt(8)
        r_hdr.font.color.rgb = RGBColor(148, 163, 184)
        
        footer = section.footer
        p_ftr = footer.paragraphs[0]
        p_ftr.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_ftr_l = p_ftr.add_run("Pipra — Built with confidence. Ship with control.  |  ASYST Platform Engineering")
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
    r_title = p_title.add_run("ASDP DIMS Frontend — Deployment Script Setup & Pipra Operational User Manual")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(20)
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("Step-by-Step Operator Guide for Zero-Downtime Blue-Green Deployment, Target Host Script Setup, Real-Time Pipeline Telemetry, and Pipra Control Plane Usage")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Document Metadata Summary Card
    meta_tbl = doc.add_table(rows=1, cols=4)
    format_table(meta_tbl, [1.6, 1.6, 1.6, 1.7], 
                 ["Document ID", "Target Application", "Security Level", "Release Engine"],
                 [["2026-10-31-v1.0", "asdp-dims-fe", "RBAC Enforced (Admin/Op)", "Blue-Green 10-Stage Machine"]])
    
    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ==========================================
    # SECTION 1: EXECUTIVE OVERVIEW
    # ==========================================
    h1 = doc.add_heading("1. Executive Overview & Architecture Bridge", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    for r in h1.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "This operational manual provides a complete, step-by-step procedure for deploying the ASDP DIMS Frontend (asdp-dims-fe) "
        "application. It establishes the bridge between the target server's standalone shell script (deploy_asdp-dims-fe.sh) and "
        "the modern Pipra Control Plane, which orchestrates, automates, and secures this deployment with real-time SSE streaming logs, "
        "centralized audit ledgers, role-based access control (RBAC), and automated sub-second rollback recovery."
    )
    
    doc.add_paragraph(
        "The core architectural pattern implemented by both systems is an isolated Blue-Green staging barrier: candidate releases "
        "are compiled into immutable container artifacts, booted on an isolated staging port (:4001), and subjected to real HTTP "
        "synthetic health probes. Live customer traffic on port :4000 is never touched until the candidate proves 100% operational."
    )

    add_callout(
        doc,
        "Core Safety Principle: Pipra never stops or interrupts an active production container during build or staging. "
        "If a build fails or staging health checks time out, the candidate container is cleanly terminated with zero impact on serving traffic.",
        title="ZERO-DOWNTIME GUARANTEE",
        color="2563EB",
        bg_color="EFF6FF"
    )

    # ==========================================
    # SECTION 2: PARAMETER MAPPING TABLE
    # ==========================================
    h2 = doc.add_heading("2. Parameter Mapping Matrix: Shell Script vs. Pipra", level=1)
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    for r in h2.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "Every parameter accepted by the deploy_asdp-dims-fe.sh bash script maps 1:1 to a first-class configuration attribute in Pipra. "
        "This eliminates command-line syntax errors and guarantees consistency across all team members."
    )

    param_tbl = doc.add_table(rows=1, cols=4)
    param_data = [
        ["--branch <branch>", "devel", "Wizard Step 2: Target Branch", "Git branch to synchronize and deploy (e.g. develop, main)."],
        ["--tag <image_tag>", "v1.0.10-b3112", "Wizard Step 2: Release Tag", "Docker image tag suffix (asdp-dims-fe:<tag>)."],
        ["--name <name>", "asdp-dims-fe", "App Catalog: Project Slug", "Production Docker container name identifier."],
        ["--env-file <file>", ".env.development", "App Catalog: Environment File", "Environment file mounted at build/run time."],
        ["--port <port>", "4000", "App Catalog: Production Port", "Live customer-facing host port serving traffic."],
        ["--staging-port <p>", "4001", "App Catalog: Staging Port", "Ephemeral port used for pre-cutover health probes."],
        ["--dockerfile <f>", "Dockerfile.jenkins", "App Catalog: Dockerfile Path", "Docker build recipe within repository root."],
        ["--app-dir <dir>", "/home/devel/asdp-dims-fe", "App Catalog: Host Directory", "Absolute remote server worktree directory."],
        ["--skip-pull", "false", "Wizard Step 3: Skip Git Pull", "Skips git fetch/pull if deploying local worktree."],
        ["--verify-local", "false", "Target Host Settings: Verify", "Runs host npm ci && npm run build verification."],
        ["Health Retries", "15 attempts", "Target Host Settings: Retries", "Max attempts to probe staging before declaring failure."],
        ["Health Interval", "2 seconds", "Target Host Settings: Interval", "Interval between HTTP synthetic probes on port :4001."]
    ]
    format_table(param_tbl, [1.5, 1.3, 1.8, 1.9], ["Shell Flag", "Default Value", "Pipra UI Mapping", "Purpose & Architectural Role"], param_data)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ==========================================
    # SECTION 3: TARGET SERVER SCRIPT SETUP
    # ==========================================
    h3 = doc.add_heading("3. Target Server Script Setup (Manual Baseline)", level=1)
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    for r in h3.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "Before deploying via Pipra or running manual commands, set up the worktree, permissions, and script on the target Linux host."
    )

    doc.add_heading("Step 3.1: Connect to Target Server via SSH", level=2)
    add_code_block(doc, "ssh devel@192.168.10.12")

    doc.add_heading("Step 3.2: Verify Git Repository Clone", level=2)
    doc.add_paragraph("Ensure the repository is cloned to the configured application directory:")
    add_code_block(doc, 
        "# Verify directory existence\n"
        "ls -ld /home/devel/asdp-dims-fe\n\n"
        "# If not yet cloned:\n"
        "git clone git@gitlab.asyst.co.id:asdp/asdp-dims-fe.git /home/devel/asdp-dims-fe\n"
        "cd /home/devel/asdp-dims-fe"
    )

    doc.add_heading("Step 3.3: Verify Environment Files", level=2)
    doc.add_paragraph("Ensure your target environment files are placed in the application root:")
    add_code_block(doc,
        "cd /home/devel/asdp-dims-fe\n"
        "ls -la .env.development .env.production\n"
        "# If missing, copy from your secure credential template\n"
        "cp .env.example .env.development"
    )

    doc.add_heading("Step 3.4: Save & Make deploy_asdp-dims-fe.sh Executable", level=2)
    doc.add_paragraph("Save the zero-downtime deployment script and grant execute permissions:")
    add_code_block(doc,
        "cd /home/devel/asdp-dims-fe\n"
        "chmod +x deploy_asdp-dims-fe.sh"
    )

    doc.add_heading("Step 3.5: Smoke-Test Script via Terminal (Optional)", level=2)
    doc.add_paragraph("Execute a dry-run or fast test deployment manually to verify host Docker privileges:")
    add_code_block(doc,
        "./deploy_asdp-dims-fe.sh \\\n"
        "  --branch devel \\\n"
        "  --tag test-manual-$(date +%s) \\\n"
        "  --name asdp-dims-fe \\\n"
        "  --port 4000 \\\n"
        "  --staging-port 4001 \\\n"
        "  --env-file .env.development \\\n"
        "  --skip-pull"
    )

    # ==========================================
    # SECTION 4: PIPRA STEP-BY-STEP USER GUIDE
    # ==========================================
    h4 = doc.add_heading("4. Step-by-Step Guide to Deploying via Pipra", level=1)
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    for r in h4.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "Pipra allows you to control, inspect, and trigger this exact deployment from a centralized web cockpit with zero manual terminal commands."
    )

    doc.add_heading("Step 4.1: Access & Sign In to Pipra", level=2)
    doc.add_paragraph("Open your browser and navigate to http://localhost:4200 (or your shared team control plane IP):")
    add_figure(doc, "01_login_light.png", "Figure 1: Pipra Secure Sign-In Portal with Role-Based Access Control")
    
    rbac_tbl = doc.add_table(rows=1, cols=3)
    rbac_data = [
        ["admin", "pipra-admin-2026", "Administrator: Full project registration, target host setup, purge, and deployment access."],
        ["operator", "pipra-ops-2026", "Operator: Launch deployment wizard, trigger atomic cutovers, initiate rollbacks."],
        ["viewer", "pipra-viewer-2026", "Viewer: Read-only observation of pipelines, live log streams, and audit history."]
    ]
    format_table(rbac_tbl, [1.5, 1.8, 3.2], ["Username", "Default Password", "Permission Scope"], rbac_data)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    doc.add_heading("Step 4.2: Register the asdp-dims-fe Project in Applications Catalog", level=2)
    doc.add_paragraph(
        "1. In the sidebar, navigate to Applications & Projects (#/apps).\n"
        "2. Click the 'Register new project' button.\n"
        "3. Enter the project configuration parameters:\n"
        "   - Project Slug: asdp-dims-fe\n"
        "   - Display Name: ASDP DIMS Frontend\n"
        "   - Git Repository URL: git@gitlab.asyst.co.id:asdp/asdp-dims-fe.git\n"
        "   - Default Branch: devel\n"
        "   - Dockerfile: Dockerfile.jenkins\n"
        "   - Host App Directory: /home/devel/asdp-dims-fe\n"
        "   - Production Port: 4000\n"
        "   - Staging Port: 4001\n"
        "4. Click Confirm."
    )
    add_figure(doc, "03_applications_light.png", "Figure 2: Pipra Applications & Multi-Project Catalog View")

    doc.add_heading("Step 4.3: Attach Target Environments to asdp-dims-fe", level=2)
    doc.add_paragraph(
        "1. In the Applications catalog, locate the ASDP DIMS Frontend project card.\n"
        "2. Click 'Add environment'.\n"
        "3. Configure target host parameters:\n"
        "   - For Local/Loopback: Host 127.0.0.1, User devel, Port 22, Auth: None.\n"
        "   - For Remote Production: Host 192.168.10.12, User devel, Auth: SSH Password / Key (stored in AES-256 Vault).\n"
        "   - Production Safeguard: Check 'Production Critical' for production environments to enforce operator confirmation barriers.\n"
        "4. Click Confirm."
    )
    add_figure(doc, "04_environments_light.png", "Figure 3: Target Environments & Host Safeguard Management")

    doc.add_heading("Step 4.4: Test Target Host SSH Connectivity", level=2)
    doc.add_paragraph(
        "Click the 'Test SSH' button next to the environment. Pipra performs an active diagnostic over SSH, querying the remote "
        "Docker daemon and verifying BuildKit availability. A green toast notification confirms active connectivity."
    )

    doc.add_heading("Step 4.5: Launching a Zero-Downtime Deployment via the Wizard", level=2)
    doc.add_paragraph(
        "1. Click 'Launch wizard' or navigate to Deploy Application (#/deploy).\n"
        "2. Complete the 3-Step Wizard:\n"
        "   - Step 1 (Target): Select ASDP DIMS Frontend and your target environment (e.g., Development Host or Production Cluster).\n"
        "   - Step 2 (Revision): Choose the branch to deploy (develop, main, release/*), review auto-generated tag (v1.0.10-b3112).\n"
        "   - Step 3 (Cutover): Review ports (:4000 & :4001), check the production cutover confirmation barrier, and click 'Deploy Release'."
    )
    add_figure(doc, "05_deploy_wizard_light.png", "Figure 4: 3-Step Zero-Downtime Deployment Wizard")

    doc.add_heading("Step 4.6: Real-Time Pipeline Monitoring & SSE Streaming Logs", level=2)
    doc.add_paragraph(
        "Pipra redirects you to the live Deployment Detail cockpit (#/deployments/:id). "
        "Execution runs asynchronously in the background. The interactive 10-stage timeline tracks each phase in real time:"
    )
    add_figure(doc, "06_deployment_detail_light.png", "Figure 5: Live 10-Stage Pipeline Cockpit with Real-Time Log Streaming")

    stages_detail_tbl = doc.add_table(rows=1, cols=3)
    stages_detail_data = [
        ["Stage 1: Preflight", "Checks host port conflicts (:4000/:4001) and snapshots rollback container.", "Pass required to proceed."],
        ["Stage 2: Source Sync", "Fetches latest commits, checks out branch, records SHA & commit author.", "Guarantees exact provenance."],
        ["Stage 4: Docker Build", "Compiles Docker image using BuildKit caching; captures build duration.", "Streams stdout/stderr in real time."],
        ["Stage 5 & 6: Staging Probes", "Launches container on :4001; sends 15 HTTP probes at 2s intervals.", "Zero customer impact on probe failure."],
        ["Stage 7 & 8: Atomic Cutover", "Performs atomic swap to port :4000; verifies live traffic stability.", "Sub-second transition (< 800ms)."],
        ["Stage 9 & 10: Finalization", "Retires pre-cutover backup, updates fleet registry, logs audit record.", "Release marked SUCCEEDED."]
    ]
    format_table(stages_detail_tbl, [1.5, 3.2, 1.8], ["Stage", "Execution Details", "Safety Assurance"], stages_detail_data)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    doc.add_heading("Step 4.7: Automated Sub-Second Rollback (Failure Safeguard)", level=2)
    doc.add_paragraph(
        "If a candidate release fails staging health probes on port :4001, Pipra automatically terminates the candidate container. "
        "The live container on port :4000 is never touched. If a failure occurs post-cutover, Pipra restores the pre-cutover backup "
        "container within < 800ms, completely preserving live customer traffic."
    )

    # ==========================================
    # SECTION 5: LIFECYCLE & MAINTENANCE
    # ==========================================
    h5 = doc.add_heading("5. Project Maintenance & Lifecycle Operations", level=1)
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)
    for r in h5.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    doc.add_paragraph(
        "- Editing Metadata: Click 'Edit' on the project card to update repository URLs, branch rules, or ports.\n"
        "- Dual-Stage Archival: Click 'Archive' to temporarily hide a project from active catalogs and the Deployment Wizard. Historical audit logs remain 100% intact.\n"
        "- Restoring Projects: Switch to the 'Archived Projects' tab and click 'Restore' to reactivate.\n"
        "- Permanent Purge: To permanently remove a project, click 'Permanently Delete' in the Archived tab and type the project slug into the typed confirmation barrier."
    )

    # ==========================================
    # SECTION 6: TROUBLESHOOTING FAQ
    # ==========================================
    h6 = doc.add_heading("6. Troubleshooting & Diagnostics FAQ", level=1)
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)
    for r in h6.runs:
        r.font.name = "Segoe UI"
        r.font.color.rgb = RGBColor(30, 58, 138)
        r.font.size = Pt(14)

    add_callout(
        doc,
        "Q: SSH check returns 'Permission denied'?\n"
        "A: Verify the remote user (devel) belongs to the docker group ('sudo usermod -aG docker devel') and check SSH vaulted credentials in Pipra.\n\n"
        "Q: Staging health check fails on attempt 15?\n"
        "A: Inspect container stdout in Pipra's log viewer. Verify environment variables in .env.development. Fix in git, push, and click Re-deploy.\n\n"
        "Q: Can I run Pipra on my laptop to manage remote servers?\n"
        "A: Yes. Run 'node server.js' on your laptop. Configure the target server IP in the environment modal. Pipra dispatches commands securely over SSH.",
        title="OPERATIONAL FAQ & DIAGNOSTICS",
        color="B45309",
        bg_color="FEF3C7"
    )

    # Save documents
    doc.save(OUTPUT_DOCX_CANONICAL)
    shutil.copyfile(OUTPUT_DOCX_CANONICAL, OUTPUT_DOCX_FRIENDLY)
    print(f"[OK] Generated Canonical DOCX: {OUTPUT_DOCX_CANONICAL}")
    print(f"[OK] Generated Friendly DOCX:  {OUTPUT_DOCX_FRIENDLY}")

if __name__ == "__main__":
    build_docx()

