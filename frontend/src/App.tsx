import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import TagsPage from "./pages/TagsPage";
import LabelsPage from "./pages/LabelsPage";
import LabelDetailPage from "./pages/LabelDetailPage";
import UploadsPage from "./pages/UploadsPage";
import ReceiptsPage from "./pages/ReceiptsPage";
import ReceiptQueuePage from "./pages/ReceiptQueuePage";
import ReceiptReviewPage from "./pages/ReceiptReviewPage";
import ItemsPage from "./pages/ItemsPage";
import ProfilesPage from "./pages/ProfilesPage";
import { ActiveProfileProvider } from "./context/ActiveProfile";

export default function App() {
  return (
    <ActiveProfileProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="/labels/:id" element={<LabelDetailPage />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/receipts/queue" element={<ReceiptQueuePage />} />
          <Route path="/receipts/queue/:id" element={<ReceiptReviewPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </ActiveProfileProvider>
  );
}
