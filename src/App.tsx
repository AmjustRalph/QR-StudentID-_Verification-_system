import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/ProtectedRoute'

import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'

import { StudentDashboardPage } from '@/pages/student/StudentDashboardPage'
import { MyCoursesPage } from '@/pages/student/MyCoursesPage'
import { AttendanceHistoryPage } from '@/pages/student/AttendanceHistoryPage'
import { ExaminationSchedulePage } from '@/pages/student/ExaminationSchedulePage'
import { StudentProfilePage } from '@/pages/student/StudentProfilePage'
import { StaffDashboardPage } from '@/pages/staff/StaffDashboardPage'
import { StaffProfilePage } from '@/pages/staff/StaffProfilePage'
import { AttendanceScanningPage } from '@/pages/staff/AttendanceScanningPage'
import { StaffAttendanceRecordsPage } from '@/pages/staff/StaffAttendanceRecordsPage'
import { ExamVerificationPage } from '@/pages/staff/ExamVerificationPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { StudentManagementPage } from '@/pages/admin/StudentManagementPage'
import { StaffAccountsPage } from '@/pages/admin/StaffAccountsPage'
import { AttendanceRecordsPage } from '@/pages/admin/AttendanceRecordsPage'
import { AdminExaminationsPage } from '@/pages/admin/AdminExaminationsPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SetupRequiredPage } from '@/pages/SetupRequiredPage'
import { missingSupabaseConfig } from '@/lib/supabase'

export default function App() {
  if (missingSupabaseConfig.length > 0) {
    return <SetupRequiredPage missing={missingSupabaseConfig} />
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Auth — redirects to the role home if already signed in. */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          {/* Reached with a recovery session in hand, so it sits outside PublicOnlyRoute. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Student */}
          <Route element={<ProtectedRoute allow={['student']} />}>
            <Route path="/student" element={<StudentDashboardPage />} />
            <Route path="/student/courses" element={<MyCoursesPage />} />
            <Route path="/student/attendance" element={<AttendanceHistoryPage />} />
            <Route path="/student/examinations" element={<ExaminationSchedulePage />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
          </Route>

          {/* Staff */}
          <Route element={<ProtectedRoute allow={['staff']} />}>
            <Route path="/staff" element={<StaffDashboardPage />} />
            <Route path="/staff/attendance" element={<AttendanceScanningPage />} />
            <Route path="/staff/records" element={<StaffAttendanceRecordsPage />} />
            <Route path="/staff/verification" element={<ExamVerificationPage />} />
            <Route path="/staff/profile" element={<StaffProfilePage />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute allow={['admin']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/students" element={<StudentManagementPage />} />
            <Route path="/admin/staff" element={<StaffAccountsPage />} />
            <Route path="/admin/attendance" element={<AttendanceRecordsPage />} />
            <Route path="/admin/examinations" element={<AdminExaminationsPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
