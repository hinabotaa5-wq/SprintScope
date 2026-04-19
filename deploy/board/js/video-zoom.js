// 動画のピンチズーム・パン（スクロール）機能
const zoomVideo = document.getElementById("myVideo");
if (zoomVideo) {
    let vScale = 1;
    let vX = 0;
    let vY = 0;
    let vInitialDist = 0;
    let vInitialScale = 1;
    let vLastTouchPos = null;

    function updateVideoTransform() {
        zoomVideo.style.transform = `translate(${vX}px, ${vY}px) scale(${vScale})`;
    }

    zoomVideo.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length === 2) {
                vInitialDist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                vInitialScale = vScale;
                vLastTouchPos = null;
            } else if (e.touches.length === 1 && vScale > 1) {
                vLastTouchPos = { x: e.touches[0].pageX, y: e.touches[0].pageY };
            }
        },
        { passive: false }
    );

    zoomVideo.addEventListener(
        "touchmove",
        (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                vScale = vInitialScale * (dist / vInitialDist);

                if (vScale < 1) {
                    vScale = 1;
                    vX = 0;
                    vY = 0;
                }
                if (vScale > 4) vScale = 4;
                updateVideoTransform();
            } else if (e.touches.length === 1 && vScale > 1 && vLastTouchPos) {
                e.preventDefault();
                const dx = e.touches[0].pageX - vLastTouchPos.x;
                const dy = e.touches[0].pageY - vLastTouchPos.y;
                vX += dx;
                vY += dy;
                vLastTouchPos = { x: e.touches[0].pageX, y: e.touches[0].pageY };
                updateVideoTransform();
            }
        },
        { passive: false }
    );

    zoomVideo.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) {
            vInitialDist = 0;
        }
        if (e.touches.length === 0) {
            vLastTouchPos = null;
            if (vScale < 1.1) {
                vScale = 1;
                vX = 0;
                vY = 0;
                updateVideoTransform();
            }
        }
    });

    let vLastTap = 0;
    zoomVideo.addEventListener("touchend", (e) => {
        if (e.touches.length > 0) return;
        const currentTime = new Date().getTime();
        const tapLength = currentTime - vLastTap;
        if (tapLength < 300 && tapLength > 0) {
            vScale = 1;
            vX = 0;
            vY = 0;
            zoomVideo.style.transition = "transform 0.2s ease";
            updateVideoTransform();
            setTimeout(() => {
                zoomVideo.style.transition = "none";
            }, 200);
            e.preventDefault();
        }
        vLastTap = currentTime;
    });
}
