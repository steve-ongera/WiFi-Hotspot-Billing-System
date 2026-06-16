import { useEffect, useState } from "react";
import { customersAPI, hotspotAPI, getErrorMessage } from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import ConfirmModal from "../../components/common/ConfirmModal";
import Pagination from "../../components/common/Pagination";
import { formatDate, formatPhone } from "../../utils/formatters";

const PAGE_SIZE = 15;

export default function ManageUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState(null);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [confirm, setConfirm] = useState(null); // { action, user }
  const [working, setWorking] = useState(false);

  const load = (q = "") => {
    setLoading(true);
    customersAPI.list(q)
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setAlert({ type: "danger", msg: "Failed to load customers." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(search);
  };

  const handleAction = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      if (confirm.action === "suspend")  await hotspotAPI.suspend(confirm.user.id);
      if (confirm.action === "activate") await hotspotAPI.activate(confirm.user.id);
      if (confirm.action === "delete")   await customersAPI.delete(confirm.user.id);
      setAlert({ type: "success", msg: `Customer ${confirm.action}d successfully.` });
      load(search);
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const paginated  = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div><h3>Customers</h3><p className="text-muted mb-0">{users.length} total</p></div>
      </div>

      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {/* Search */}
      <div className="wb-card mb-4">
        <form onSubmit={handleSearch} className="d-flex gap-2">
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input className="form-control" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-wb-primary px-4">Search</button>
          {search && <button type="button" className="btn btn-wb-outline" onClick={() => { setSearch(""); load(""); }}>Clear</button>}
        </form>
      </div>

      <div className="wb-card">
        {loading ? <LoadingSpinner /> : paginated.length === 0 ? (
          <div className="wb-empty py-4"><i className="bi bi-people" /><p>No customers found.</p></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="wb-table">
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Email</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {paginated.map((u) => (
                    <tr key={u.id}>
                      <td>{u.first_name} {u.last_name}</td>
                      <td><span className="wb-mono">{formatPhone(u.phone_number)}</span></td>
                      <td style={{ color: "var(--wb-text-muted)", fontSize: "0.875rem" }}>{u.email || "—"}</td>
                      <td>
                        {u.is_suspended
                          ? <span className="wb-badge wb-badge-red"><span className="wb-status-dot offline" />Suspended</span>
                          : <span className="wb-badge wb-badge-green"><span className="wb-status-dot online" />Active</span>}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>{formatDate(u.created_at)}</td>
                      <td>
                        <div className="d-flex gap-1">
                          {u.is_suspended
                            ? <button className="btn btn-sm btn-wb-outline" onClick={() => setConfirm({ action: "activate", user: u })} title="Activate"><i className="bi bi-person-check" /></button>
                            : <button className="btn btn-sm btn-wb-outline" onClick={() => setConfirm({ action: "suspend", user: u })} title="Suspend"><i className="bi bi-person-x" /></button>}
                          <button className="btn btn-sm btn-wb-danger" onClick={() => setConfirm({ action: "delete", user: u })} title="Delete"><i className="bi bi-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4"><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
          </>
        )}
      </div>

      <ConfirmModal
        show={!!confirm}
        title={confirm?.action === "delete" ? "Delete Customer" : confirm?.action === "suspend" ? "Suspend Customer" : "Activate Customer"}
        message={`Are you sure you want to ${confirm?.action} ${confirm?.user?.first_name || "this customer"}?`}
        confirmLabel={confirm?.action?.charAt(0).toUpperCase() + confirm?.action?.slice(1)}
        confirmVariant={confirm?.action === "delete" ? "btn-wb-danger" : "btn-wb-primary"}
        loading={working}
        onConfirm={handleAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}