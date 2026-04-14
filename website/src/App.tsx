import { HashRouter, Routes, Route } from "react-router-dom";
import CourseRoadmap from "./components/CourseRoadmap";
import LessonPage from "./pages/LessonPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<CourseRoadmap />} />
        <Route path="/phase/:phaseId/lesson/:lessonId" element={<LessonPage />} />
      </Routes>
    </HashRouter>
  );
}
