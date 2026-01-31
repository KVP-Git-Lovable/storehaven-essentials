# Plan: Strengthen Staff Management Module

## Overview
Comprehensive enhancement of the Staff module covering employee onboarding, attendance with face recognition, leave management, and performance tracking.

## Phase 1: Enhanced Employee Data Model

### Database Changes - `employees` table expansion:
| Field | Type | Description |
|-------|------|-------------|
| manager_id | UUID (self-ref) | Reporting manager |
| store_id | UUID | Assigned store |
| aadhar_number | TEXT | Masked Aadhar |
| pan_number | TEXT | PAN card |
| permanent_address | TEXT | Address |
| current_address | TEXT | Current address |
| education_level | TEXT | Highest education |
| emergency_contact_name | TEXT | Emergency contact |
| emergency_contact_phone | TEXT | Emergency phone |
| emergency_contact_relation | TEXT | Relationship |
| face_baseline_url | TEXT | Face photo for recognition |
| onboarding_status | TEXT | draft/pending_approval/approved/rejected |
| onboarding_approved_by | TEXT | Approver name |
| onboarding_approved_at | TIMESTAMP | Approval date |

### New Tables:

**employee_documents**
- id, employee_id, document_type (aadhar/pan/address_proof/education/certification)
- file_url, file_name, verified, verified_by, verified_at

**employee_competencies**
- id, employee_id, skill_name, proficiency_level (1-5)
- certified, certification_date, expiry_date

**manager_feedback**
- id, employee_id, feedback_by, feedback_date
- performance_rating (1-5), attitude_rating, teamwork_rating
- strengths, areas_of_improvement, action_items

## Phase 2: Attendance & Leave System

### New Tables:

**attendance_records**
- id, employee_id, store_id, attendance_date
- check_in_time, check_out_time
- check_in_photo_url, check_out_photo_url
- check_in_latitude, check_in_longitude, check_in_address
- check_out_latitude, check_out_longitude
- status (present/late/half_day/absent)
- face_match_score

**leave_types**
- id, name (Casual/Sick/Annual/Comp-off), paid, max_per_year, carry_forward

**leave_balances**
- id, employee_id, leave_type_id, year
- opening_balance, granted, used, lapsed, available

**leave_requests**
- id, employee_id, leave_type_id
- from_date, to_date, days_count, half_day_type
- reason, status (pending/approved/rejected)
- approved_by, approved_at, rejection_reason

**leave_transactions**
- id, employee_id, leave_type_id, transaction_type (grant/use/lapse/adjust)
- days, effective_date, notes

## Phase 3: Performance Management

### New Tables:

**performance_reviews**
- id, employee_id, review_period_start, review_period_end
- reviewed_by, review_date
- overall_rating (1-5), ranking_in_team
- kra_achievement, competency_score
- strengths, weaknesses
- training_needs, career_interests
- promotion_potential (high/medium/low)
- status (draft/submitted/acknowledged)

**training_recommendations**
- id, employee_id, review_id
- training_topic, priority (high/medium/low)
- target_completion_date, completed_at

## Files to Create/Modify

### New Components:
1. `src/components/staff/EmployeeOnboardingForm.tsx` - Multi-step onboarding
2. `src/components/staff/DocumentUploadSection.tsx` - File uploads
3. `src/components/staff/CompetencyMapper.tsx` - Skill mapping
4. `src/components/staff/FaceCaptureDialog.tsx` - Face baseline capture
5. `src/components/staff/AttendanceMarkDialog.tsx` - Mark attendance with face
6. `src/components/staff/LeaveBalanceCard.tsx` - Balance display
7. `src/components/staff/LeaveApplyDialog.tsx` - Apply for leave
8. `src/components/staff/ManagerFeedbackForm.tsx` - Periodic feedback
9. `src/components/staff/PerformanceReviewForm.tsx` - Performance review

### Pages:
1. `src/pages/staff/Employees.tsx` - Enhanced with onboarding
2. `src/pages/staff/Attendance.tsx` - Face recognition + geo
3. `src/pages/staff/LeaveManagement.tsx` - NEW: Leave apply/approve
4. `src/pages/staff/PerformanceReviews.tsx` - NEW: Performance tracking

## Implementation Order
1. Database migration (all tables)
2. Enhanced Employees page with onboarding
3. Attendance with face capture and geo
4. Leave management system
5. Performance reviews
6. Sample data for testing

## Expected Outcome
- Complete employee lifecycle management
- Secure attendance with face verification
- Leave tracking with balance calculations
- Performance insights for talent development
