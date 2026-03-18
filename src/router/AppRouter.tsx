import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { HomePage } from '../pages/HomePage';
import { PracticePage } from '../pages/PracticePage';
import { ResultPage } from '../pages/ResultPage';
import { WrongPage } from '../pages/WrongPage';
import { ReviewPage } from '../pages/ReviewPage';
import { ParentPage } from '../pages/ParentPage';
import { SettingsPage } from '../pages/SettingsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/wrong" element={<WrongPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/parent" element={<ParentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
