import React, { useContext, useEffect, useState } from "react";
import { ReactNode } from "react";
import { useWindowStateChangeListener, WindowSize } from "demo-base";
import { loadURLAsDataURL } from "../utils/urlReader";
import { CartoonConfig, CartoonOperationParams, generateCartoonDefaultConfig, generateDefaultCartoonParams } from "@dannadori/white-box-cartoonization-worker-js";

type Props = {
    children: ReactNode;
};

type AppStateValue = {
    windowSize: WindowSize;
    inputSourceType: string | null;
    setInputSourceType: (source: string | null) => void;
    inputSource: string | MediaStream | null;
    setInputSource: (source: MediaStream | string | null) => void;

    config: CartoonConfig;
    setConfig: (config: CartoonConfig) => void;
    params: CartoonOperationParams;
    setParams: (params: CartoonOperationParams) => void;
};

const AppStateContext = React.createContext<AppStateValue | null>(null);

export const useAppState = (): AppStateValue => {
    const state = useContext(AppStateContext);
    if (!state) {
        throw new Error("useAppState must be used within AppStateProvider");
    }
    return state;
};

const initialInputSourcePath = "mov/Model.mp4";

const initialConfig = generateCartoonDefaultConfig();
const initialParams = generateDefaultCartoonParams();

export const AppStateProvider = ({ children }: Props) => {
    const { windowSize } = useWindowStateChangeListener();
    const [inputSourceType, setInputSourceType] = useState<string | null>(null);
    const [inputSource, _setInputSource] = useState<MediaStream | string | null>(null);
    const setInputSource = (source: MediaStream | string | null) => {
        if (inputSource instanceof MediaStream) {
            inputSource.getTracks().forEach((x) => {
                x.stop();
            });
        }
        _setInputSource(source);
    };

    const [config, setConfig] = useState(initialConfig);
    const [params, setParams] = useState(initialParams);

    useEffect(() => {
        const loadInitialInputSource = async (path: string) => {
            const data = await loadURLAsDataURL(path);
            setInputSource(data);
        };
        loadInitialInputSource(initialInputSourcePath);
    }, []);

    const providerValue = {
        windowSize,
        inputSourceType,
        setInputSourceType,
        inputSource,
        setInputSource,

        config,
        setConfig,
        params,
        setParams,
    };

    return <AppStateContext.Provider value={providerValue}>{children}</AppStateContext.Provider>;
};
