import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { packagesAPI } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import PackageCard from "../../components/packages/PackageCard";
import MpesaModal from "../../components/payments/MpesaModal";

export default function PurchasePackage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pkg, setPkg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    packagesAPI.get(id)
      .then(setPkg)
      .catch(() => setError("Package not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <button className="btn btn-wb-ghost mb-4" onClick={() => navigate("/packages")}>
        <i className="bi bi-arrow-left me-2" />Back to Packages
      </button>

      <h3 className="mb-4">Purchase Package</h3>

      <AlertMessage type="danger" message={error} onClose={() => setError("")} />

      {pkg && (
        <div className="row g-4">
          <div className="col-md-5">
            <PackageCard pkg={pkg} selected onSelect={() => {}} />
          </div>
          <div className="col-md-7 d-flex align-items-center">
            <div className="wb-card w-100">
              <h5 className="mb-3">Ready to connect?</h5>
              <p className="text-muted mb-4">
                Click below to pay via M-Pesa STK Push. You will receive a prompt
                on your phone to enter your PIN.
              </p>
              <button className="btn btn-wb-cyan w-100 py-2" onClick={() => setShowModal(true)}>
                <i className="bi bi-phone me-2" />Pay with M-Pesa
              </button>
            </div>
          </div>
        </div>
      )}

      <MpesaModal
        show={showModal}
        pkg={pkg}
        onClose={() => setShowModal(false)}
        onSuccess={() => navigate("/dashboard")}
      />
    </div>
  );
}