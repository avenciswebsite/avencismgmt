We should build this as an Avencis Employee Attendance & Payroll Management Web App.

The most important thing is to design it for a multi-client workforce, not just a normal attendance application.

Avencis should be able to manage:

* Its own employees working at the Avencis office.  
* Employees on Avencis payroll but deployed at different client locations.  
* Employees working at client locations under different employment/payroll arrangements.  
* Different attendance, leave and salary policies for different employees or clients.

I recommend building one central web application with separate Admin, HR/Payroll, Manager and Employee dashboards.

# **1\. Overall application structure**

AVENCIS ADMIN PANEL

Central control over employees, clients, attendance and payroll

HR / Payroll

Employee records, leave, salary, payslips and compliance

Managers

Team attendance, leave approval and corrections

Client Managers

View their deployed workforce and attendance

Employees

Check-in, check-out, leave and payslips

Central Database

Employee master · Attendance · Leave · Payroll · Client locations · Audit logs

# **2\. Employee master database**

Every employee should have a unique Employee ID.

One very important design decision: keep the employer, payroll responsibility, client and actual work location as separate fields.

For example:

| Field | Example |
| ----- | ----- |
| Employee ID | AV001 |
| Employee Name | Rahul |
| Employer / Payroll Entity | Avencis |
| Deployed Client | Client A |
| Work Location | Pune Branch |
| Department | Operations |
| Reporting Manager | Manager A |
| Joining Date | 01-11-2026 |
| Fixed Monthly Salary | ₹20,000 |
| Variable Incentive | As applicable |
| Weekly Off | Sunday |
| Leave Policy | Policy A |
| Attendance Status | Active |

This will allow you to add 10, 20 or 50 client locations without creating separate attendance systems.

# **3\. Employee attendance module**

Core module

Employees should log in using their mobile number/email and password or OTP.

Their dashboard should have two prominent actions.

Employee Attendance

Sample dashboard  
Monday, 02 November 2026

# **09:32 AM**

Current attendance status: Not checked in

CHECK IN

Record start time

CHECK OUT

Record end time

Today's details

| Field | Value |
| ----- | ----- |
| Assigned location | Pune Branch |
| Check-in time | Pending |
| Check-out time | Pending |
| GPS location | Pending |
| Working hours | Pending |
| Attendance status | Not marked |

Illustrative dashboard, not a live attendance system.

Every check-in and check-out should capture:

1. Employee ID.  
2. Date and exact time.  
3. GPS coordinates.  
4. Location name.  
5. Assigned client/location.  
6. Device information.  
7. Photo/selfie (optional).  
8. Attendance event type.  
9. GPS accuracy and location verification status.

Important controls:

* Check-in should be allowed only once per working session, with configurable multiple shifts.  
* Check-out cannot be earlier than check-in.  
* Employees should not be able to edit their own attendance records.  
* Missed check-in/out should generate an attendance correction request.  
* Admin/manager should approve corrections.  
* Store original records and maintain an audit trail.

For multiple locations, use location-based geofencing with an admin-configurable radius. Allow authorised exceptions for field employees.

# **4\. Attendance and paid-days calculation**

This is one of the most important modules because attendance must ultimately feed into payroll.

The system should automatically classify every calendar day.

| Attendance status | Payroll treatment |
| ----- | ----- |
| Present | Paid day |
| Half Day | Configurable paid fraction |
| Paid Leave | Paid day |
| Unpaid Leave | Unpaid day |
| Weekly Off | Paid as per policy |
| Public Holiday | Paid as per policy |
| Absent | Unpaid day |
| Compensatory Off | As per policy |
| Work From Home | Paid day if approved |
| Client Holiday | Based on assigned policy |

At month-end, generate an employee-wise paid-days summary.

Example:

| Particulars | Days |
| ----- | ----- |
| Total calendar days | 30 |
| Weekly offs | 4 |
| Public holidays | 1 |
| Present days | 21 |
| Paid leaves | 2 |
| Unpaid leaves | 1 |
| Total paid days | 28 |
| Total unpaid days | 1 |

The calculation engine should avoid double-counting weekly offs and holidays.

# **5\. Leave management module**

This should be a configurable leave management system.

### **Leave categories**

| Leave type | Description |
| ----- | ----- |
| Paid Leave (PL) | Monthly credited leave |
| Casual Leave (CL) | As per company policy |
| Sick Leave (SL) | As per company policy |
| Unpaid Leave (LWP) | Salary deduction |
| Compensatory Off | Earned for approved extra working |
| Special Leave | Admin-configurable |

### **Leave balance management**

Each employee should have a leave account.

For example:

| Particulars | Days |
| ----- | ----- |
| Opening balance | 2 |
| Monthly leave credited | 2 |
| Total available | 4 |
| Leave applied | 2 |
| Leave approved | 2 |
| Closing balance | 2 |

The application should support:

* Automatic leave credit every month.  
* Leave carry-forward to the next year.  
* Maximum carry-forward limits.  
* Leave expiry rules.  
* Paid and unpaid leave distinction.  
* Leave balance visible to employees.  
* Leave encashment, if applicable.  
* Half-day leave.  
* Backdated leave requests, subject to approval.

### **Leave approval workflow**

1. Employee applies for leave  
   Select leave type, dates and reason.  
2. Reporting manager receives request  
   Checks team availability and leave balance.  
3. Manager approves / rejects  
   Decision recorded in the system.  
4. Leave balance updated  
   Paid leave is deducted from the balance; unpaid leave is recorded for payroll.  
5. Payroll updated  
   Approved leave automatically reflects in monthly salary calculations.

# **6\. Payroll management module**

This should be integrated with attendance and leave, rather than operated as a separate spreadsheet.

### **Employee salary structure**

Each employee should have the following salary components:

| Salary component | Example |
| ----- | ----- |
| Fixed monthly salary | ₹20,000 |
| Performance incentive | ₹2,000 |
| Other allowance | ₹1,000 |
| Gross earnings | ₹23,000 |
| PF deduction | As configured |
| ESIC deduction | As configured |
| Professional tax | As applicable |
| TDS | As applicable |
| Unpaid leave deduction | Calculated |
| Net salary | Automatically calculated |

### **Monthly payroll calculation**

Example:

* Fixed monthly salary: ₹20,000  
* Variable incentive: ₹2,000  
* Monthly payable days: 30  
* Paid days: 29  
* Unpaid days: 1

Assuming salary is calculated on a 30-day basis:

$Salary=20,000\times \frac{29}{30}$

Fixed salary payable \= ₹19,333.33.

Then add eligible incentives and allowances and subtract applicable deductions.

The salary divisor should be configurable according to the company's payroll policy and applicable wage rules. Do not automatically assume every employee has a 30-day divisor.

### **PF and ESIC configuration**

Even if Avencis is not currently providing PF and ESIC, build the sections into the system now.

| Feature | Required functionality |
| ----- | ----- |
| PF Applicable | Yes / No |
| PF Employee Contribution | Configurable |
| PF Employer Contribution | Configurable |
| ESIC Applicable | Yes / No |
| ESIC Employee Contribution | Configurable |
| ESIC Employer Contribution | Configurable |
| Professional Tax | State-wise configurable |
| TDS | Annual taxable income-based calculation |

Keep statutory rates, wage ceilings, eligibility and effective dates configurable. The system should not automatically deduct PF or ESIC just because a checkbox is enabled; eligibility and applicable law must first be validated.

# **7\. Payslip generation**

Admin/HR should be able to generate payslips for any employee for any month.

AVENCIS

Sample payslip

## **Salary Slip**

November 2026

Employee Details

| Particulars | Details |
| ----- | ----- |
| Employee | Rahul |
| Employee ID | AV001 |
| Department | Operations |
| Designation | Executive |
| Payroll Entity | Avencis |

Salary Details

| Earnings | Amount |
| ----- | ----- |
| Fixed salary | ₹20,000 |
| Incentive | ₹2,000 |
| Total earnings | ₹22,000 |
| Deductions | ₹1,000 |
| Net salary | ₹21,000 |

Illustrative only

Generated

Features:

* Generate individual payslips.  
* Generate payslips in bulk.  
* Download as PDF.  
* Share with employees.  
* Employee self-service payslip download.  
* Payslip generation history.  
* Reissue corrected payslips with revision tracking.

# **8\. Admin dashboard and reports**

The Admin dashboard should provide an overall view of the workforce.

Total employees

# **150**

Present today

# **128**

On leave

# **8**

Absent / missing

# **14**

Illustrative dashboard figures.

### **Essential reports**

1. Daily attendance report.  
2. Employee-wise monthly attendance.  
3. Client-wise attendance.  
4. Location-wise attendance.  
5. Late coming and early leaving report.  
6. Leave balance report.  
7. Paid days and unpaid days report.  
8. Monthly payroll register.  
9. Salary payable report.  
10. PF and ESIC calculation report.  
11. Incentive report.  
12. Payslip register.

# **9\. User roles and permissions**

| Role | Access |
| ----- | ----- |
| Super Admin | Complete application control |
| HR Admin | Employees, attendance, leave |
| Payroll Admin | Salary, deductions, payslips |
| Client Manager | Assigned client workforce only |
| Location Manager | Employees at assigned location |
| Employee | Own attendance, leave and payslips |

A client manager should not see another client's employees or their salary details.

# **10\. Important application settings**

I recommend making the following settings configurable by Super Admin, rather than hardcoding them.

| Setting | Configuration |
| ----- | ----- |
| Weekly offs | Sunday / Saturday / custom |
| Monthly paid leave | e.g. 2 days |
| Leave carry-forward | Yes / No |
| Maximum leave balance | Configurable |
| Attendance grace period | e.g. 10 minutes |
| Late mark policy | Configurable |
| Half-day working hours | Configurable |
| Full-day working hours | Configurable |
| Salary calculation divisor | 26 / 30 / calendar days |
| Overtime | Enabled / Disabled |
| Incentive structure | Fixed / Performance-based |
| PF and ESIC | Enabled / Disabled per employee |
| Location restriction | Enabled / Disabled |

Very important: Different clients may have different weekly offs, holidays, working hours and attendance requirements. These should be controlled by employee-specific or client-specific policies.

# **11\. Recommended technology and application design**

For this application, I recommend:

* Frontend: React / Next.js – web application, mobile-friendly.  
* Backend: Supabase or equivalent secure backend.  
* Database: PostgreSQL.  
* Authentication: Email/mobile OTP and role-based access.  
* Location tracking: Browser GPS permission and geofencing.  
* Payslips: PDF generation.  
* Hosting: Secure cloud hosting.

The application should work on mobile browsers as well as desktops, so employees don't need to install an app initially.

Security requirements:

* Role-based access.  
* Client-wise data segregation.  
* Encrypted sensitive employee data.  
* Audit logs for attendance, leave and payroll changes.  
* Secure payslip access.  
* Backups and recovery.  
* Employee consent for location capture.

# **12\. Development roadmap**

I would not build everything at once. Develop it in three phases.

Phase 1 – Attendance & Leave

Priority 1

Core application

* Employee master  
* Client and location management  
* Employee login  
* Check-in / check-out  
* GPS tracking  
* Daily attendance  
* Leave application and approval  
* Paid days and weekly offs  
* Admin dashboard

Phase 2 – Payroll

Financial management

* Fixed and variable salary  
* Attendance-based salary calculation  
* Paid / unpaid leave deductions  
* PF / ESIC / PT / TDS configuration  
* Monthly payroll processing  
* Payslip generation  
* Payroll reports

Phase 3 – Advanced Management

Automation and control

* Client-wise workforce reports  
* Automated attendance alerts  
* Overtime management  
* Employee performance incentives  
* Payroll approval workflow  
* Bulk payslip sharing  
* Advanced analytics

# **13\. Five decisions to finalise before development**

There are a few business rules that we should settle before building the application. My suggested defaults are below.

| Decision | Suggested default |
| ----- | ----- |
| Leave credit | 2 paid leaves every month, configurable |
| Leave carry-forward | Configurable annual limit |
| Attendance | GPS-based check-in/out |
| Salary calculation | Based on approved paid days |
| Payroll approval | HR prepares, Admin approves |

One additional design requirement: an employee's employer/payroll entity must be separate from their deployed client. This will be critical if Avencis manages payroll for multiple clients.

## **My recommendation for the next step**

Let's first create a complete Application Requirement Document (ARD) and screen-by-screen application blueprint. This will become the master specification for development.

I would like to establish one important distinction first:

Will Avencis manage only employees who are legally on Avencis payroll, or will the system also manage employees who are directly on the client's payroll?

This will determine how we design employer records, salary processing, payslips, statutory compliance and client access.

