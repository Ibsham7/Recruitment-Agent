import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Search, 
  X, 
  ChevronsUpDown, 
  ChevronDown, 
  HelpCircle, 
  RotateCcw, 
  MessageCircle 
} from "lucide-react";
import { Theme } from "../../../lib/types";
import { hexToRgba } from "../../../lib/theme";
import { landingFaqs, getFaqCategoryIcon } from "../landingData";

interface FaqSectionProps {
  theme: Theme;
  onEnter: () => void;
}

export function FaqSection({ theme: t, onEnter }: FaqSectionProps) {
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>("");
  const [openFaqs, setOpenFaqs] = useState<number[]>([]);

  const filteredFaqs = landingFaqs.filter((faq) => {
    const query = faqSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      faq.q.toLowerCase().includes(query) ||
      faq.a.toLowerCase().includes(query) ||
      faq.category.toLowerCase().includes(query)
    );
  });

  const toggleFaq = (idx: number) => {
    setOpenFaqs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const isAllExpanded =
    filteredFaqs.length > 0 &&
    filteredFaqs.every((_, i) => openFaqs.includes(i));

  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      setOpenFaqs([]);
    } else {
      setOpenFaqs(filteredFaqs.map((_, i) => i));
    }
  };

  return (
    <section id="ha-faq" className="w-full px-4 sm:px-8 lg:px-12 py-24 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ color: t.accentBadge, background: hexToRgba(t.accentBadge, 0.10), border: `1px solid ${hexToRgba(t.accentBadge, 0.22)}`, fontFamily: "'DM Mono',monospace" }}>
          <Sparkles size={13} /> Architecture & Guidance FAQ
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", color: t.txtPrimary, fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 600, lineHeight: 1.15 }}>
          Frequently Asked Questions
        </h2>
        <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: t.txtSecondary }}>
          Everything you need to know about hireagent's screening engine, candidate experience, data privacy, and recruiting workflow.
        </p>
      </motion.div>

      {/* Control Bar: Search Input & Expand All Toggle */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl border"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.16 : 0.60),
            borderColor: hexToRgba(t.txtBody, 0.10),
            backdropFilter: "blur(16px)"
          }}>
          
          {/* Search Input Box */}
          <div className="relative flex-1 w-full flex items-center">
            <Search size={17} className="absolute left-3.5 pointer-events-none" style={{ color: t.txtGhost }} />
            <input
              type="text"
              value={faqSearchQuery}
              onChange={(e) => setFaqSearchQuery(e.target.value)}
              placeholder="Search questions, screening, privacy, setup..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs sm:text-sm bg-transparent outline-none transition-colors"
              style={{
                color: t.txtPrimary,
              }}
            />
            {faqSearchQuery ? (
              <button
                onClick={() => setFaqSearchQuery("")}
                className="absolute right-3.5 p-1 rounded-full hover:bg-white/10 text-xs transition-colors"
                style={{ color: t.txtGhost }}
                title="Clear search query"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="absolute right-3 hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border" style={{ color: t.txtGhost, borderColor: hexToRgba(t.txtBody, 0.1) }}>
                /
              </span>
            )}
          </div>

          {/* Results count & Expand All Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 px-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg" style={{ color: t.txtGhost, background: hexToRgba(t.txtBody, 0.05) }}>
              {filteredFaqs.length} {filteredFaqs.length === 1 ? "question" : "questions"}
            </span>

            <button
              onClick={handleToggleExpandAll}
              disabled={filteredFaqs.length === 0}
              className="cursor-target flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 disabled:opacity-40"
              style={{
                background: isAllExpanded ? hexToRgba(t.accentPrimary, 0.15) : hexToRgba(t.txtBody, 0.05),
                borderColor: isAllExpanded ? t.accentPrimary : hexToRgba(t.txtBody, 0.10),
                color: isAllExpanded ? t.accentPrimary : t.txtSecondary
              }}
            >
              <ChevronsUpDown size={14} />
              <span>{isAllExpanded ? "Collapse All" : "Expand All"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* FAQ Accordion List */}
      {filteredFaqs.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openFaqs.includes(idx);
            const CategoryIcon = getFaqCategoryIcon(faq.category);

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="rounded-2xl border overflow-hidden transition-all duration-300 group"
                style={{
                  background: isOpen
                    ? hexToRgba(t.bgCard, t.isDark ? 0.28 : 0.85)
                    : hexToRgba(t.bgCard, t.isDark ? 0.10 : 0.45),
                  borderColor: isOpen
                    ? hexToRgba(t.accentPrimary, 0.45)
                    : hexToRgba(t.txtBody, 0.08),
                  backdropFilter: "blur(14px)",
                  boxShadow: isOpen ? `0 6px 24px ${hexToRgba(t.accentPrimary, 0.12)}` : "none"
                }}
              >
                <button
                  id={`faq-btn-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${idx}`}
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 sm:py-5 flex items-center justify-between text-left cursor-target focus:outline-none"
                >
                  <div className="flex items-start gap-3.5 pr-4">
                    {/* Category Icon Badge */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300"
                      style={{
                        background: isOpen
                          ? hexToRgba(t.accentPrimary, 0.20)
                          : hexToRgba(t.txtBody, 0.05),
                        color: isOpen ? t.accentPrimary : t.txtSecondary,
                      }}
                    >
                      <CategoryIcon size={16} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit"
                          style={{
                            color: t.accentBadge,
                            background: hexToRgba(t.accentBadge, 0.12),
                            border: `1px solid ${hexToRgba(t.accentBadge, 0.20)}`
                          }}
                        >
                          {faq.category}
                        </span>
                      </div>
                      <span className="text-sm sm:text-base font-semibold leading-snug" style={{ color: t.txtPrimary }}>
                        {faq.q}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="shrink-0 ml-2 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      background: isOpen ? hexToRgba(t.accentPrimary, 0.15) : "transparent",
                      color: isOpen ? t.accentPrimary : t.txtGhost
                    }}
                  >
                    <ChevronDown size={18} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${idx}`}
                      role="region"
                      aria-labelledby={`faq-btn-${idx}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-6 pb-5 pt-3 text-sm leading-relaxed border-t flex flex-col gap-3"
                        style={{
                          color: t.txtSecondary,
                          borderColor: hexToRgba(t.txtBody, 0.06),
                          background: hexToRgba(t.bgSurface, t.isDark ? 0.20 : 0.30)
                        }}
                      >
                        <p>{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty Search Filter State */
        <div
          className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border"
          style={{
            background: hexToRgba(t.bgCard, t.isDark ? 0.08 : 0.30),
            borderColor: hexToRgba(t.txtBody, 0.08)
          }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: hexToRgba(t.accentBadge, 0.15), color: t.accentBadge }}>
            <HelpCircle size={24} />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: t.txtPrimary }}>
            No matching questions found
          </h3>
          <p className="text-xs mb-5 max-w-sm" style={{ color: t.txtSecondary }}>
            We couldn't find any questions matching "{faqSearchQuery}".
          </p>
          <button
            onClick={() => setFaqSearchQuery("")}
            className="cursor-target flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{
              background: hexToRgba(t.accentPrimary, 0.15),
              color: t.accentPrimary,
              border: `1px solid ${hexToRgba(t.accentPrimary, 0.3)}`
            }}
          >
            <RotateCcw size={14} /> Clear Search
          </button>
        </div>
      )}

      {/* ── STILL HAVE QUESTIONS FALLBACK CTA ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-12 p-6 sm:p-8 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(t.bgCard, t.isDark ? 0.35 : 0.90)}, ${hexToRgba(t.bgSurface, t.isDark ? 0.45 : 0.85)})`,
          borderColor: hexToRgba(t.accentPrimary, 0.25),
          boxShadow: `0 8px 32px ${hexToRgba(t.accentPrimary, 0.08)}`,
          backdropFilter: "blur(16px)"
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.8)})`,
              color: t.accentText
            }}
          >
            <MessageCircle size={22} />
          </div>
          <div>
            <h4 className="text-base font-bold mb-1" style={{ color: t.txtPrimary }}>
              Still have questions?
            </h4>
            <p className="text-xs leading-relaxed max-w-md" style={{ color: t.txtSecondary }}>
              Can't find what you're looking for? Talk to our recruiting architecture specialists or explore our platform onboarding walkthrough.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={onEnter}
            className="cursor-target px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${t.accentPrimary}, ${hexToRgba(t.accentPrimary, 0.85)})`,
              color: t.accentText,
              boxShadow: `0 4px 16px ${hexToRgba(t.accentPrimary, 0.35)}`
            }}
          >
            Get Started →
          </button>
        </div>
      </motion.div>
    </section>
  );
}
