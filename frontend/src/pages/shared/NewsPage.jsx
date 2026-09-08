import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import FileUpload from "../../components/FileUpload";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function NewsPage() {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isBreaking, setIsBreaking] = useState(false);
  const [image, setImage] = useState(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data } = await api.get("/news");
    setNews(data);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setMsg("");
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("body", body);
      formData.append("isBreaking", isBreaking);
      if (image) formData.append("image", image);
      await api.post("/news", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setTitle(""); setBody(""); setIsBreaking(false); setImage(null);
      load();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not post news");
    }
  }

  return (
    <DashboardLayout>
      {user?.role === "admin" && (
        <Card title="Post News">
          <form onSubmit={handleCreate} className="space-y-3">
            <input className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              placeholder="Body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
            <FileUpload accept="image/*" label="Upload an image (optional)" onFileSelect={setImage} />
            <label className="flex items-center gap-2 text-sm dark:text-slate-300">
              <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} />
              Mark as Breaking News
            </label>
            <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Post</button>
            {msg && <p className="text-red-600 text-sm">{msg}</p>}
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {news.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">No news yet.</p>}
        {news.map((n) => (
          <div key={n.id} className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-xl overflow-hidden">
            {n.imageUrl && <img src={n.imageUrl} alt={n.title} className="w-full max-h-64 object-cover" />}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {n.isBreaking && (
                  <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-medium">BREAKING</span>
                )}
                <h3 className="font-semibold dark:text-slate-100">{n.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
              <p className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
