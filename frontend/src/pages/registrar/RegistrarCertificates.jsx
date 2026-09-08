import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import AcademicSelector from "../../components/AcademicSelector";
import { listRegistrarStudents, getTranscript, getCertificateTemplateForStudent } from "../../api/resources";
import { splitYears } from "../../utils/ethiopianCalendar";
import { getLayout } from "../../utils/certificateLayouts";

const TYPE_LABELS = { original: "Original", temporary: "Temporary" };

// These templates are scanned at 300 DPI (confirmed: 3301px / 300 = 11.00in,
// exactly matching US Letter's long edge). Used both to size the printed
// @page to the certificate's real physical dimensions, and — critically —
// to make the shrink-to-fit calculation below immune to screen-vs-print
// rendering-width differences, by comparing physical inches instead of
// "however many CSS px wide the image currently happens to be displayed."
const CERTIFICATE_SCAN_DPI = 300;

// CSS's universal reference-pixel anchor: 1 inch = 96 CSS px, true in every
// rendering context (screen, print, any zoom level) per the CSS spec — not
// an assumption we're making, a fixed rule browsers guarantee. This is what
// lets us convert a text element's scrollWidth (in CSS px) into a physical
// inch measurement directly comparable against the certificate's own
// physical width, with no dependency on rendered display size at all.
const CSS_PX_PER_INCH = 96;

export default function RegistrarCertificates() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [browseResults, setBrowseResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [requestedType, setRequestedType] = useState("original");
  const [templateResult, setTemplateResult] = useState(null); // { eligible, template, certificateType }
  const [imgStatus, setImgStatus] = useState("idle"); // idle | loading | loaded | error
  const docRef = useRef(null);
  const imgRef = useRef(null);
  const [naturalImageWidthPx, setNaturalImageWidthPx] = useState(0); // the image's fixed native pixel width — never changes between screen/print, unlike rendered display width
  const [pageSizeMM, setPageSizeMM] = useState(null); // { width, height } in mm, for the printed @page

  // Fires once when the certificate image finishes loading. Both values
  // derived here come from the image's NATIVE pixel dimensions (naturalWidth/
  // naturalHeight), not its current on-screen rendered size — that's the key
  // property that makes them stable regardless of Card width, browser
  // window size, or whether we're currently in print layout.
  useEffect(() => {
    if (imgStatus !== "loaded" || !imgRef.current) return;
    const img = imgRef.current;
    setNaturalImageWidthPx(img.naturalWidth);
    setPageSizeMM({
      width: (img.naturalWidth / CERTIFICATE_SCAN_DPI) * 25.4,
      height: (img.naturalHeight / CERTIFICATE_SCAN_DPI) * 25.4,
    });
  }, [imgStatus]);

  useEffect(() => {
    const id = searchParams.get("studentId");
    if (id) openCertificate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSearch(e) {
    e.preventDefault();
    setResults(await listRegistrarStudents({ search: search || undefined, recordStatus: "active,graduated" }));
  }

 async function handleBrowse({ departmentId, levelId, graduated }) {
    if (graduated) {
      setBrowseResults(await listRegistrarStudents({ departmentId, recordStatus: "graduated" }));
      return;
    }
    setBrowseResults(levelId ? await listRegistrarStudents({ levelId, recordStatus: "active" }) : []);
  }

  async function openCertificate(id, type = requestedType) {
    setImgStatus("loading");
    const [studentData, tmplResult] = await Promise.all([
      getTranscript(id),
      getCertificateTemplateForStudent(id, type),
    ]);
    setStudent(studentData);
    setTemplateResult(tmplResult);
  }

  function changeType(type) {
    setRequestedType(type);
    if (student) openCertificate(student.id, type);
  }

  useEffect(() => {
    if (!templateResult?.template) setImgStatus("idle");
  }, [templateResult]);

  function handlePrint() {
    window.print();
  }

  const eligible = templateResult?.eligible !== false;
  const template = templateResult?.template;
  const certificateType = templateResult?.certificateType;
  const isTvet = student?.track === "tvet";
  const layout =
    student && eligible && certificateType
      ? getLayout(student.track, certificateType, student.department?.name)
      : null;

  const startYears = student?.courseStartDate ? splitYears(student.courseStartDate) : null;
  const endYears = student?.courseEndDate ? splitYears(student.courseEndDate) : null;

  return (
    <DashboardLayout>
      <Card title="Browse by Track / Department / Level">
       <AcademicSelector mode="level" onSelect={handleBrowse} compact showGraduated />
        {browseResults.length > 0 && (
          <div className="mt-4">
            <Table
              columns={[
                { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
                { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
                { key: "dept", label: "Department", render: (r) => r.department?.name },
                { key: "status", label: "Level / Status", render: (r) => (
                  r.recordStatus === "graduated"
                    ? <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Graduated</span>
                    : r.level?.name
                ) },
                { key: "view", label: "", render: (r) => (
                  <button onClick={() => openCertificate(r.id)} className="text-teal-600 text-sm hover:underline">
                    Generate Certificate
                  </button>
                ) },
              ]}
              rows={browseResults}
              emptyLabel="No students found"
            />
          </div>
        )}
      </Card>

      <Card title="Find Student">
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 flex-1"
            placeholder="Search by name or username" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Search</button>
        </form>
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "status", label: "Level / Status", render: (r) => (
              r.recordStatus === "graduated"
                ? <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Graduated</span>
                : r.level?.name
            ) },
            { key: "view", label: "", render: (r) => (
              <button onClick={() => openCertificate(r.id)} className="text-teal-600 text-sm hover:underline">
                Generate Certificate
              </button>
            ) },
          ]}
          rows={results}
          emptyLabel="Search to find a student"
        />
      </Card>

      {student && !eligible && (
        <Card title="Certificate">
          <p className="text-sm text-ink-muted dark:text-slate-400">
            <strong>{student.user.fullName}</strong> is a Level 2 Terminal student ({student.department.name}) —
            this program is not eligible for certificate generation.
          </p>
        </Card>
      )}

      {student && eligible && (
        <Card title="Certificate" action={
          <button onClick={handlePrint} className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm">
            Print / Save as PDF
          </button>
        }>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-ink-muted dark:text-slate-400">Type:</span>
            <div className="flex gap-2">
              {["original", "temporary"].map((t) => (
                <button key={t} onClick={() => changeType(t)}
                  className={`px-3 py-1 text-xs rounded-full ${requestedType === t ? "bg-teal-600 text-white" : "bg-navy-950/5 dark:bg-slate-700 dark:text-slate-300"}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {!template && (
            <p className="text-sm text-gold-600 mb-3">
              No {TYPE_LABELS[certificateType]} certificate template has been uploaded yet for{" "}
              {student.department.name} ({student.track}). Upload one via{" "}
              <code className="mx-1 id-chip">POST /admin/certificate-templates</code>
              (track: {student.track}, type: {certificateType}). Showing a generic placeholder for now.
            </p>
          )}

          {template && imgStatus === "error" && (
            <p className="text-sm text-red-600 mb-3">
              The template image at <code className="id-chip">{template.imageUrl}</code> failed to load —
              check the file exists and the server can serve <code className="id-chip">/uploads/*</code> paths.
            </p>
          )}

          {template && layout ? (
            <div id="certificate-print-area" ref={docRef} className="relative inline-block bg-white">
              <img
                ref={imgRef}
                src={template.imageUrl}
                alt="Certificate template"
                className="block max-w-full"
                onLoad={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
              />
              {imgStatus === "loaded" && (
                <>
                  <Overlay field={layout.name} value={student.user.fullName} bold naturalImageWidthPx={naturalImageWidthPx} />
                  {student.fullNameAmharic && layout.nameAmharic && (
                    <Overlay field={layout.nameAmharic} value={student.fullNameAmharic} bold naturalImageWidthPx={naturalImageWidthPx} />
                  )}

                  {isTvet && certificateType === "original" && startYears && layout.startYearGc && (
                    <Overlay field={layout.startYearGc} value={startYears.gc} naturalImageWidthPx={naturalImageWidthPx} />
                  )}
                  {isTvet && certificateType === "original" && startYears && layout.startYearEc && (
                    <Overlay field={layout.startYearEc} value={startYears.ec} naturalImageWidthPx={naturalImageWidthPx} />
                  )}

                  {endYears && layout.endYearGc && <Overlay field={layout.endYearGc} value={endYears.gc} naturalImageWidthPx={naturalImageWidthPx} />}
                  {endYears && layout.endYearEc && <Overlay field={layout.endYearEc} value={endYears.ec} naturalImageWidthPx={naturalImageWidthPx} />}
                </>
              )}
            </div>
          ) : (
            <div id="certificate-print-area" ref={docRef} className="border-4 border-navy-950 p-10 bg-white text-center text-black">
              <h2 className="font-display font-bold text-xl mb-1">SITTI MEDICAL AND BUSINESS COLLEGE</h2>
              <p className="text-xs text-gray-500 mb-6">{TYPE_LABELS[certificateType] || "Certificate"} of Completion</p>
              <p className="text-sm mb-2">This is to certify that</p>
              <p className="font-display text-2xl font-semibold mb-1">{student.user.fullName}</p>
              {student.fullNameAmharic && <p className="font-display text-lg mb-2">{student.fullNameAmharic}</p>}
              <p className="text-sm mb-4">
                has successfully completed the {student.department.name} program at {student.level.name}
              </p>
              <p className="text-xs mb-6">{endYears ? `${endYears.gc} G.C / ${endYears.ec} E.C.` : ""}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-xs">
                <p>Registrar: ____________________</p>
                <p>Dean: ____________________</p>
              </div>
              <p className="text-xs text-gray-400 mt-4">ID: {student.user.username}</p>
            </div>
          )}
        </Card>
      )}

      <style>{`
        ${pageSizeMM ? `
        @page {
          size: ${pageSizeMM.width.toFixed(1)}mm ${pageSizeMM.height.toFixed(1)}mm;
          margin: 0;
        }
        ` : ""}
        @media print {
          body * { visibility: hidden; }
          #certificate-print-area, #certificate-print-area * { visibility: visible; }
          #certificate-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            border: none !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}

// Renders one overlay value at a layout-defined position, centered on that
// point using measured pixel margins (ordinary box-model math — reliable in
// both screen and print, unlike CSS transform percentages).
//
// Shrink-to-fit: if `field.maxWidth` is set, the text scales down to stay
// within that width, floored at `field.minScale` (default 0.5). See
// useFitScale below for why this is computed in physical inches rather than
// rendered CSS pixels.
function Overlay({ field, value, bold, naturalImageWidthPx }) {
  const align = field.align || "left";
  const textRef = useRef(null);
  const scale = useFitScale(textRef, value, naturalImageWidthPx, field.maxWidth, field.minScale);
  const offset = useCenterOffset(textRef, align, value);

  return (
    <div
      ref={textRef}
      className="absolute text-black"
      style={{
        top: field.top,
        left: field.left,
        marginTop: offset.marginTop,
        marginLeft: offset.marginLeft,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: align === "center" ? "center" : "left center",
        fontSize: field.fontSize,
        fontFamily: "Newsreader, serif",
        fontWeight: bold ? 600 : 400,
        textAlign: align,
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  );
}

function useCenterOffset(textRef, align, value) {
  const [offset, setOffset] = useState({ marginTop: 0, marginLeft: 0 });
  useLayoutEffect(() => {
    if (!textRef.current) return;
    const h = textRef.current.offsetHeight;
    const w = textRef.current.offsetWidth;
    setOffset({
      marginTop: -h / 2,
      marginLeft: align === "center" ? -w / 2 : 0,
    });
  }, [textRef, value, align]);
  return offset;
}

// Compares PHYSICAL INCHES on both sides of the fit check, not rendered CSS
// pixels — that's the actual fix. Previously this compared "how many CSS px
// wide is the text" against "how many CSS px wide is the image CURRENTLY
// DISPLAYED at" — and that second number changes constantly (Card width,
// browser window, and critically, screen vs. print layout, where the image
// jumps from a constrained on-screen width to full print-page width). Any
// time those two contexts disagreed, the shrink math was comparing numbers
// from two different scales. Converting both sides to inches — the image
// via its fixed native pixel width / CERTIFICATE_SCAN_DPI, the text via its
// CSS pixel scrollWidth / the universal CSS_PX_PER_INCH constant — makes
// both sides physical measurements that don't depend on current render
// context at all, so there's no screen/print mismatch left to break.
function useFitScale(textRef, value, naturalImageWidthPx, maxWidthPercent, minScale = 0.5) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!maxWidthPercent || !naturalImageWidthPx || !textRef.current) {
      setScale(1);
      return;
    }
    const imageWidthInches = naturalImageWidthPx / CERTIFICATE_SCAN_DPI;
    const maxWidthInches = (parseFloat(maxWidthPercent) / 100) * imageWidthInches;
    const naturalPx = textRef.current.scrollWidth;
    const naturalInches = naturalPx / CSS_PX_PER_INCH;
    if (!naturalInches || naturalInches <= maxWidthInches) {
      setScale(1);
      return;
    }
    setScale(Math.max(maxWidthInches / naturalInches, minScale));
  }, [textRef, value, naturalImageWidthPx, maxWidthPercent, minScale]);
  return scale;
}