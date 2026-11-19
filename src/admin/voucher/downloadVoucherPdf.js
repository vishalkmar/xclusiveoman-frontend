// Renders <VoucherDocument> off-screen, rasterises it with html-to-image and
// saves it as a one-page A4 PDF — so the download is pixel-identical to the
// live preview in the Create/Edit Voucher form.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import VoucherDocument, { PAGE_W, PAGE_H } from "./VoucherDocument.jsx";
import { withTemplateDefaults } from "./voucherTemplate.js";

const BLANK_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

function waitForImages(node) {
  const imgs = [...node.querySelectorAll("img")];
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          })
    )
  );
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export async function downloadVoucherPdf(voucher) {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const v = withTemplateDefaults(voucher);
    root.render(createElement(VoucherDocument, { v }));
    await nextFrame();
    await waitForImages(host);
    if (document.fonts?.ready) await document.fonts.ready;
    await nextFrame();
    const page = host.firstElementChild;
    const canvas = await toCanvas(page, {
      width: PAGE_W,
      height: PAGE_H,
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      imagePlaceholder: BLANK_GIF,
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    const name = String(v.bookingId || "voucher").replace(/[^\w.-]+/g, "_");
    pdf.save(`${name}_Voucher.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
