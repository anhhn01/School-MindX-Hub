import { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import StudentSubmissionPortal from "@/components/features/submission/StudentSubmissionPortal";

export const metadata: Metadata = {
  title: "Cổng Nộp Bài Học Viên | School MindX Hub",
  description: "Cổng nộp bài tập và dự án chính thức dành cho học viên MindX",
};

export default function SubmitPage() {
  return (
    <AppLayout
      pageTitle="Cổng Nộp Bài Học Viên"
      breadcrumbs={[
        { label: "Hệ thống", href: "/" },
        { label: "Cổng nộp bài học viên" },
      ]}
    >
      <StudentSubmissionPortal />
    </AppLayout>
  );
}
