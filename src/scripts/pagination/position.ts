// These listeners belong to the router lifetime, including pages without a picker.
// History traversal must retain Astro's saved position rather than force the bottom.
let preservePosition = false;
let navigationRevision = 0;
let positionFrame = 0;
document.addEventListener("astro:before-preparation", event => {
  preservePosition =
    event.navigationType === "traverse" || event.info?.restoreScroll === true;
  navigationRevision += 1;
  if (positionFrame) cancelAnimationFrame(positionFrame);
  positionFrame = 0;
});
async function retainPaginationBottom(): Promise<void> {
  if (
    preservePosition ||
    location.hash !== "#pagination" ||
    !document.querySelector("#pagination")
  )
    return;
  const revision = navigationRevision;
  await document.fonts.ready;
  if (revision !== navigationRevision) return;
  if (positionFrame) cancelAnimationFrame(positionFrame);
  positionFrame = requestAnimationFrame(() => {
    positionFrame = 0;
    if (
      revision === navigationRevision &&
      !preservePosition &&
      location.hash === "#pagination" &&
      document.querySelector("#pagination")
    )
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      });
  });
}
document.addEventListener("astro:page-load", retainPaginationBottom);
void retainPaginationBottom();
