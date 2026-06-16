import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { packagesAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import PackageCard from "../../components/packages/PackageCard";
import MpesaModal from "../../components/payments/MpesaModal";

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    packagesAPI.list()
      .then((data) => setPackages(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load packages."))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (pkg) => { setSelected(pkg); setShowModal(true); };

  const handleSuccess = () => {
    setShowModal(false);
    navigate("/dashboard");
  };

  if (loading) return <LoadingSpinner fullPage />;

  const single  = packages.filter((p) => p.device_limit === 1);
  const shared  = packages.filter((p) => p.device_limit > 1);

  return (
    <div>
      <div className="mb-4">
        <h3>Internet Packages</h3>
        <p className="text-muted">Choose a package and pay via M-Pesa.</p>
      </div>

      <AlertMessage type="danger" message={error} onClose={() => setError("")} />

      {packages.length === 0 && !loading && (
        <div className="wb-empty"><i className="bi bi-wifi-off" /><p>No packages available right now.</p></div>
      )}

      {single.length > 0 && (
        <>
          <h5 className="mb-3"><i className="bi bi-person me-2 text-cyan" />Single Device</h5>
          <div className="row g-3 mb-4">
            {single.map((pkg) => (
              <div key={pkg.id} className="col-sm-6 col-lg-4">
                <PackageCard pkg={pkg} selected={selected?.id === pkg.id} onSelect={handleSelect} />
              </div>
            ))}
          </div>
        </>
      )}

      {shared.length > 0 && (
        <>
          <h5 className="mb-3"><i className="bi bi-people me-2 text-cyan" />Shared / Hotspot</h5>
          <div className="row g-3">
            {shared.map((pkg) => (
              <div key={pkg.id} className="col-sm-6 col-lg-4">
                <PackageCard pkg={pkg} selected={selected?.id === pkg.id} onSelect={handleSelect} />
              </div>
            ))}
          </div>
        </>
      )}

      <MpesaModal
        show={showModal}
        pkg={selected}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}