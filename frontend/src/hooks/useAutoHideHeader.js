import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_AFTER_Y = 40;
const DOWNWARD_HIDE_DISTANCE = 8;
const UPWARD_REVEAL_DISTANCE = 12;

function getScrollTop(scrollContainer)
{
    return scrollContainer === window
        ? window.scrollY
        : scrollContainer.scrollTop;
}

function getScrollContainers(element)
{
    const scrollContainers = [window];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement)
    {
        const { overflowY } = window.getComputedStyle(current);
        if (/(auto|scroll|overlay)/.test(overflowY)) scrollContainers.push(current);
        current = current.parentElement;
    }

    return scrollContainers;
}

export default function useAutoHideHeader(contentRef, enabled = true)
{
    const [hidden, setHidden] = useState(false);
    const hiddenRef = useRef(false);
    const scrollContainersRef = useRef([]);

    const setHeaderHidden = useCallback((nextHidden) => {
        if (hiddenRef.current === nextHidden) return;
        hiddenRef.current = nextHidden;
        setHidden(nextHidden);
    }, []);

    useEffect(() => {
        if (!enabled || !contentRef.current) return undefined;

        const scrollContainers = getScrollContainers(contentRef.current);
        scrollContainersRef.current = scrollContainers;
        const lastScrollPositions = new Map(
            scrollContainers.map(scrollContainer => [scrollContainer, getScrollTop(scrollContainer)])
        );
        let downwardDistance = 0;
        let upwardDistance = 0;
        let frameId = null;

        const onScroll = (event) => {
            if (frameId !== null) return;
            const scrollContainer = event.currentTarget;

            frameId = requestAnimationFrame(() => {
                frameId = null;
                const currentY = Math.max(0, getScrollTop(scrollContainer));
                const lastScrollY = lastScrollPositions.get(scrollContainer) ?? currentY;
                const delta = currentY - lastScrollY;
                lastScrollPositions.set(scrollContainer, currentY);

                if (currentY <= 0) {
                    downwardDistance = 0;
                    upwardDistance = 0;
                    setHeaderHidden(false);
                    return;
                }

                if (delta > 0) {
                    downwardDistance += delta;
                    upwardDistance = Math.max(0, upwardDistance - delta);

                    if (currentY > HIDE_AFTER_Y
                        && downwardDistance >= DOWNWARD_HIDE_DISTANCE) {
                        setHeaderHidden(true);
                        upwardDistance = 0;
                    }
                } else if (delta < 0) {
                    const upwardDelta = Math.abs(delta);
                    upwardDistance += upwardDelta;
                    downwardDistance = Math.max(0, downwardDistance - upwardDelta);

                    if (upwardDistance >= UPWARD_REVEAL_DISTANCE) {
                        setHeaderHidden(false);
                        downwardDistance = 0;
                    }
                }
            });
        };

        scrollContainers.forEach(scrollContainer => {
            scrollContainer.addEventListener("scroll", onScroll, { passive: true });
        });

        return () => {
            scrollContainers.forEach(scrollContainer => {
                scrollContainer.removeEventListener("scroll", onScroll);
            });
            if (frameId !== null) cancelAnimationFrame(frameId);
        };
    }, [contentRef, enabled, setHeaderHidden]);

    const scrollToTop = useCallback(() => {
        scrollContainersRef.current.forEach(scrollContainer => {
            scrollContainer.scrollTo({ top: 0, behavior: "instant" });
        });
        setHeaderHidden(false);
    }, [setHeaderHidden]);

    return { hidden, scrollToTop };
}
