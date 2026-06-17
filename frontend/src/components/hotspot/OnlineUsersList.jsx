/**
 * components/hotspot/OnlineUsersList.jsx
 * Admin widget: live table of currently connected hotspot users.
 * Supports disconnect action inline.
 */
import { useState } from "react";
import { hotspotAPI, getErrorMessage } from "../../services/api";
import { formatBytes, formatDate } from "../../utils/formatters";
import ConfirmModal from "../common/ConfirmModal";
import AlertMessage from "../common/AlertMessage";

export default function OnlineUsersList({ users = [], onRefresh }) {
  const [target, setTarget]   = useState(null);   // user to disconnect
  const [working, setWorking] = useState(false);
  const [alert, setAlert]     = useState(null);

  const handleDisconnect = async () => {
    if (!target) return;
    setWorking(true);
    try {
      await hotspotAPI.disconnect(target.id);
      setAlert({ type: "success", msg: `${target.username} disconnected.` });
      onRefresh && onRefresh();
    } catch (ex) {
      setAlert({ type: "danger", msg: getErrorMessage(ex) });
    } finally {
      setWorking(false);
      setTarget(null);
    }
  };

  return (
    <>
      <AlertMessage type={alert?.type} message={alert?.msg} onClose={() => setAlert(null)} />

      {users.length === 0 ? (
        <div className="wb-empty py-4">
          <i className="bi bi-wifi-off" />
          <h6>No users online</h6>
          <p>Connected customers will appear here in real time.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="wb-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Package</th>
                <th>IP Address</th>
                <th>Downloaded</th>
                <th>Uploaded</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="wb-status-dot online" />
                      <span className="wb-mono">{u.username}</span>
                    </div>
                  </td>
                  <td>{u.package_name}</td>
                  <td>
                    <span className="wb-mono" style={{ fontSize: "0.8125rem" }}>
                      {u.ip_address || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="text-cyan">
                      {formatBytes(u.mikrotik_bytes_in || 0)}
                    </span>
                  </td>
                  <td>
                    <span className="text-green">
                      {formatBytes(u.mikrotik_bytes_out || 0)}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--wb-text-muted)" }}>
                    {formatDate(u.expires_at)}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-wb-danger"
                      title="Disconnect"
                      onClick={() => setTarget(u)}
                    >
                      <i className="bi bi-wifi-off" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        show={!!target}
        title="Disconnect User"
        message={`Disconnect ${target?.username} from the hotspot? Their session will end immediately.`}
        confirmLabel="Disconnect"
        confirmVariant="btn-wb-danger"
        loading={working}
        onConfirm={handleDisconnect}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}