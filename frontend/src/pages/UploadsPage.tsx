import { useEffect, useState } from "react";
import { Title, Stack } from "@mantine/core";
import FileUpload from "../components/FileUpload";
import UploadLog from "../components/UploadLog";
import DataCoverage from "../components/DataCoverage";
import api from "../api/client";
import type { BankAccount } from "../types";

export default function UploadsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchBanks = async () => {
    const res = await api.get("/banks");
    setBankAccounts(res.data);
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleUploaded = () => {
    fetchBanks();
    setRefreshKey((k) => k + 1);
  };

  const handleDeleted = () => {
    fetchBanks();
    setRefreshKey((k) => k + 1);
  };

  return (
    <Stack>
      <Title order={2}>Uploads</Title>
      <FileUpload onUploaded={handleUploaded} />
      <DataCoverage refreshKey={refreshKey} />
      <UploadLog
        bankAccounts={bankAccounts}
        refreshKey={refreshKey}
        onDeleted={handleDeleted}
      />
    </Stack>
  );
}
