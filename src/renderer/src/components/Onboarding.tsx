import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LampContainer } from './ui/lamp';
import { FlipWords } from './ui/flip-words';
import { HoverBorderGradient } from './ui/hover-border-gradient';
import { ShootingStars } from './ui/shooting-stars';
import { StarsBackground } from './ui/stars-background';
import { Spotlight } from './ui/spotlight';

import { ArrowRight, Search, Check, Sparkles } from 'lucide-react';

// Brand SVG Icons from Simple Icons
const OpenAIIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
    </svg>
);

const ClaudeIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
    </svg>
);

const GeminiIcon = ({ className }: { className?: string }) => (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
    </svg>
);

// Typewriter effect component
const TypewriterText = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    
    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, 50);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, onComplete]);
    
    return (
        <span>
            {displayedText}
            {currentIndex < text.length && (
                <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-cyan-400"
                >
                    |
                </motion.span>
            )}
        </span>
    );
};

// Search result item
const SearchResult = ({ title, source, delay }: { title: string; source: string; delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50"
    >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{title}</p>
            <p className="text-xs text-neutral-500">{source}</p>
        </div>
    </motion.div>
);

interface OnboardingProps {
    onComplete: () => void;
}

const steps = [
    { id: 'welcome' },
    { id: 'connect' },
    { id: 'search' },
    { id: 'ready' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            localStorage.setItem('onboarding_completed', 'true');
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 overflow-hidden">
            <AnimatePresence mode="wait">
                {/* Step 0: Welcome with Lamp Effect */}
                {currentStep === 0 && (
                    <motion.div
                        key="step-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full"
                    >
                        {/* Background effects */}
                        <StarsBackground className="absolute inset-0" />
                        <ShootingStars />
                        <LampContainer className="min-h-screen bg-slate-950">
                            <motion.h1
                                initial={{ opacity: 0.5, y: 100 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: 0.3,
                                    duration: 0.8,
                                    ease: "easeInOut",
                                }}
                                className="bg-gradient-to-br from-slate-100 to-slate-400 py-4 bg-clip-text text-center text-4xl font-bold tracking-tight text-transparent md:text-7xl"
                            >
                                Your Memories <br />
                                <span className="text-cyan-400">Unified</span>
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                                className="mt-4 text-center text-slate-400 max-w-lg mx-auto text-lg"
                            >
                                Stop searching through endless chat history. All your AI conversations in one powerful, searchable knowledge base.
                            </motion.p>
                        </LampContainer>
                    </motion.div>
                )}

                {/* Step 1: Connect Assistants with Shooting Stars */}
                {currentStep === 1 && (
                    <motion.div
                        key="step-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full bg-neutral-950 relative"
                    >
                        {/* Background effects */}
                        <StarsBackground className="absolute inset-0" />
                        <ShootingStars />
                        
                        <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl md:text-6xl lg:text-7xl font-bold text-center text-white"
                            >
                                Connect your{" "}
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">assistants</span>
                            </motion.h2>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-xl md:text-2xl mt-8 text-neutral-400 text-center"
                            >
                                Seamlessly import from
                                <FlipWords 
                                    words={['Claude', 'ChatGPT', 'Gemini', 'Perplexity']} 
                                    className="text-cyan-400 font-semibold"
                                />
                            </motion.div>
                            
                            {/* Feature cards */}
                            <div className="grid grid-cols-3 gap-10 mt-20 max-w-3xl mx-auto">
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-[#10A37F] flex items-center justify-center">
                                        <OpenAIIcon className="w-9 h-9 text-white" />
                                    </div>
                                    <span className="text-lg font-medium text-neutral-200">ChatGPT</span>
                                </motion.div>
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-[#D4A27F] flex items-center justify-center">
                                        <ClaudeIcon className="w-9 h-9 text-[#1A1915]" />
                                    </div>
                                    <span className="text-lg font-medium text-neutral-200">Claude</span>
                                </motion.div>
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                                        <GeminiIcon className="w-9 h-9 text-white" />
                                    </div>
                                    <span className="text-lg font-medium text-neutral-200">Gemini</span>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Instant Recall with Shooting Stars & Typewriter */}
                {currentStep === 2 && (
                    <motion.div
                        key="step-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full bg-neutral-950 relative"
                    >
                        {/* Background effects */}
                        <StarsBackground className="absolute inset-0" starDensity={0.0003} />
                        <ShootingStars 
                            starColor="#22d3ee"
                            trailColor="#6366f1"
                        />
                        
                        <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="text-4xl md:text-6xl lg:text-7xl font-bold text-white text-center"
                            >
                                Instant{" "}
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                    Recall
                                </span>
                            </motion.h2>
                            
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="mt-6 text-xl md:text-2xl text-neutral-400 text-center max-w-2xl"
                            >
                                Just ask. We remember the details so you don't have to.
                            </motion.p>
                            
                            {/* Search demo with typewriter */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="mt-12 w-full max-w-xl space-y-3"
                            >
                                <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
                                    <Search className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                                    <span className="text-neutral-300 text-lg">
                                        <TypewriterText 
                                            text="What did Claude say about React patterns?"
                                        />
                                    </span>
                                </div>
                                
                                {/* Animated search results */}
                                <div className="space-y-2">
                                    <SearchResult 
                                        title="Use composition over inheritance for components..."
                                        source="Claude • 2 days ago"
                                        delay={2.5}
                                    />
                                    <SearchResult 
                                        title="The Container/Presenter pattern separates logic..."
                                        source="Claude • 1 week ago"
                                        delay={2.8}
                                    />
                                    <SearchResult 
                                        title="Custom hooks are great for reusable stateful logic..."
                                        source="Claude • 2 weeks ago"
                                        delay={3.1}
                                    />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Ready to start with Spotlight */}
                {currentStep === 3 && (
                    <motion.div
                        key="step-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full bg-neutral-950 relative overflow-hidden"
                    >
                        {/* Starry background */}
                        <StarsBackground className="absolute inset-0" />
                        <ShootingStars />
                        
                        {/* Spotlight effect */}
                        <Spotlight
                            className="-top-40 left-0 md:left-60 md:-top-20"
                            fill="#22d3ee"
                        />
                        <Spotlight
                            className="top-10 left-full -translate-x-[50%] md:-top-20"
                            fill="#6366f1"
                        />
                        
                        <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
                            {/* Animated icon */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ 
                                    duration: 0.8, 
                                    type: "spring",
                                    stiffness: 100
                                }}
                                className="mb-12"
                            >
                                <div className="relative">
                                    <div className="h-28 w-28 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                                        <Check className="w-14 h-14 text-white" strokeWidth={2.5} />
                                    </div>
                                    {/* Glow ring */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: [0.5, 0.2, 0.5], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 -m-2 rounded-[2rem] border border-cyan-500/50"
                                    />
                                </div>
                            </motion.div>
                            
                            <motion.h2
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.6 }}
                                className="text-5xl md:text-7xl lg:text-8xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
                            >
                                You're all set
                            </motion.h2>
                            
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.5 }}
                                className="mt-6 text-xl md:text-2xl text-neutral-400 text-center max-w-xl"
                            >
                                Your personal AI knowledge base awaits.
                            </motion.p>
                            
                            {/* Feature highlights */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7, duration: 0.5 }}
                                className="mt-12 flex gap-6"
                            >
                                {['All chats synced', 'Instant search', 'Always learning'].map((feature, i) => (
                                    <div key={feature} className="flex items-center gap-2 text-neutral-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation - Fixed at bottom */}
            <div className="fixed bottom-10 md:bottom-16 left-0 right-0 flex flex-col items-center gap-6 z-50">
                {/* Progress dots */}
                <div className="flex gap-3">
                    {steps.map((_, idx) => (
                        <motion.div
                            key={idx}
                            initial={false}
                            animate={{
                                width: currentStep === idx ? 32 : 6,
                                backgroundColor: currentStep === idx ? "#fff" : "rgba(255,255,255,0.2)"
                            }}
                            className="h-1.5 rounded-full"
                            transition={{ duration: 0.3 }}
                        />
                    ))}
                </div>

                <HoverBorderGradient
                    containerClassName="rounded-full"
                    as="button"
                    className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 px-8 py-3 font-medium"
                    onClick={handleNext}
                >
                    <span className="text-base">
                        {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                </HoverBorderGradient>
            </div>
        </div>
    );
}
