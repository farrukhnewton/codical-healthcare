import { useFavorites } from "@/hooks/use-favorites";
import { CodeCard } from "@/components/codes/CodeCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Bookmark, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";

export function Favorites() {
  const { data: favorites, isLoading, isError, refetch } = useFavorites();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <div className="p-6 max-w-5xl min-h-full relative">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center gap-4 mb-12"
      >
        <motion.div 
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-secondary/50 flex items-center justify-center shadow-lg shadow-accent/30"
        >
          <Bookmark className="w-7 h-7 text-white" />
        </motion.div>
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Your Workspace</h1>
          <p className="text-lg text-muted-foreground font-medium">Curated medical codes for rapid access</p>
        </div>
      </motion.div>

      {isLoading ? (
        <LoadingState message="Loading your workspace..." />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : favorites?.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative text-center py-32 bg-white/50 backdrop-blur rounded-3xl border border-border/50 shadow-2xl shadow-primary/5 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="relative"
          >
            <Star className="w-20 h-20 text-muted-foreground/20 mx-auto mb-6" />
          </motion.div>
          <h3 className="text-2xl font-black text-foreground mb-3 relative">Start Building Your Workspace</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-lg relative">
            Save frequently-used diagnosis and procedure codes for instant access and clinical reference.
          </p>
          <Link href="/">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" className="rounded-full shadow-xl shadow-primary/30 gap-2 font-bold text-base">
                <Search className="w-5 h-5" /> Explore Medical Records
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {favorites?.map((fav, idx) => (
            <motion.div key={fav.id} variants={itemVariants}>
              <CodeCard 
                code={{
                  type: fav.codeType,
                  code: fav.code,
                  description: fav.description
                }}
                onClick={() => {}}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 text-center text-sm text-muted-foreground"
      >
        <p className="font-semibold tracking-widest uppercase">
          {favorites?.length || 0} Code{favorites?.length !== 1 ? "s" : ""} Saved
        </p>
      </motion.div>
    </div>
  );
}
