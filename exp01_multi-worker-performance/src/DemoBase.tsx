import React from 'react';
import './App.css';
import 'semantic-ui-css/semantic.min.css'
import { Dropdown, Button } from 'semantic-ui-react';



interface ImageAnalyzerModelManager {
    init(config: any): Promise<any>,
    predict(canvas: HTMLCanvasElement, params: any): Promise<any>
}

class DemoBase extends React.Component {
    imageElementRef = React.createRef<HTMLImageElement>()
    videoElementRef = React.createRef<HTMLVideoElement>()
    originalCanvas = React.createRef<HTMLCanvasElement>()
    resultCanvasRef = React.createRef<HTMLCanvasElement>()
    targetElement?: HTMLImageElement | HTMLVideoElement
    controllerRef = React.createRef<ControllerUI>()
    pfmRef = React.createRef<PerformanceCanvas>()

    deviceList?: any
    controller?: any

    managers?: ImageAnalyzerModelManager[]
    configs?:any[]
    paramss?: any[]
    IMAGE_PATH = "./yuka_kawamura.jpg"
    RESULT_OVERLAY = true
    MAX_WIDTH = 640

    reloadRequired = false
    originalCanvasSizeChange = false

    getCustomMenu = () => {
        const menu: ControllerUIProp[] = []
        return menu
    }

    handleResult = (prediction: any) => { }

    requireReload = () =>{
        this.reloadRequired = true
    }

    originalCanvasSizeChanged = (width:number, height:number) =>{
        console.log("original canvas size changed")
    }

    private adjustCanvaSize(input:HTMLImageElement|HTMLVideoElement){
        const loadedFunc = () =>{
            const [width, height] = input.tagName.toUpperCase() === "IMG" ?  
                (() => {
                    const element = input as HTMLImageElement
                    const width = element.naturalWidth
                    const height = element.naturalHeight
                    return [width, height]
                })()
                :
                (() => {
                    const element = input as HTMLVideoElement
                    const width = element.videoWidth
                    const height = element.videoHeight
                    return [width, height]
                })()

            const canvasScale = width > this.MAX_WIDTH ? 
                this.MAX_WIDTH / width : 1.0
            const canvasWidth = width * canvasScale
            const canvasHeight = height * canvasScale
            input.width = width
            input.height = height
            this.originalCanvas.current!.width = canvasWidth
            this.originalCanvas.current!.height = canvasHeight
            this.resultCanvasRef.current!.width = canvasWidth
            this.resultCanvasRef.current!.height = canvasHeight
            this.targetElement = input
            this.originalCanvasSizeChange = true
        }
        if(input.tagName.toUpperCase() === "IMG"){
            (input as HTMLImageElement).onload = loadedFunc
        }else{
            input.onloadedmetadata = loadedFunc
        }
    }
    

    private generateController = (videoInput: MediaDeviceInfo[]) => {
        const inputVideoIds = videoInput.map(x => {
            return x.deviceId
        })
        inputVideoIds.push("image/movie")
        inputVideoIds.push("window")
        const inputVideoLabels = videoInput.map(x => {
            return x.label
        })
        inputVideoLabels.push("image/movie")
        inputVideoLabels.push("window")

        const customMenu = this.getCustomMenu()

        const params: ControllerUIProp[] = [
            {
                title: "input",
                currentIndexOrValue: inputVideoLabels.length - 2,
                values: inputVideoIds,
                displayLabels: inputVideoLabels,
                fileValue: ["image/movie"],
                windowValue: ["window"],
                fileCallback:(fileType:string, path:string)=>{
                    if(fileType.startsWith("image")){
                        this.adjustCanvaSize(this.imageElementRef.current!)
                        this.imageElementRef.current!.src=path
                    }else if(fileType.startsWith("video")){
                        this.adjustCanvaSize(this.videoElementRef.current!)
                        this.videoElementRef.current!.pause()
                        this.videoElementRef.current!.srcObject = null
                        this.videoElementRef.current!.src = path
                        this.videoElementRef.current!.currentTime=0
                        this.videoElementRef.current!.autoplay = true
                        this.videoElementRef.current!.play()
                    }else{
                        console.log("unknwon file type", fileType)
                    }
                },
                callback: ((val: string | number | MediaStream) => {
                    if (typeof (val) == "string") {
                        navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: {
                                deviceId: val,
                                width: { ideal: 1280 },
                                height: { ideal: 720 }
                            }
                        }).then(media => {
                            this.adjustCanvaSize(this.videoElementRef.current!)
                            this.videoElementRef.current!.srcObject = media
                            this.videoElementRef.current!.play()
                        })
                    } else {
                        console.log("unknwon input.", val)
                    }
                })
            },
            ...customMenu
        ]
        const controller = <ControllerUI ref={this.controllerRef} controllerUIProps={params} />
        return controller
    }

    private setupold = (manager: ImageAnalyzerModelManager, config: any) => {
        const managerPromise = manager.init(Object.assign({}, config))
        const devicePromise = getDeviceLists()

        Promise.all([managerPromise, devicePromise]).then(res => {
            console.log(res)
            this.deviceList = res[1]
            this.adjustCanvaSize(this.imageElementRef.current!)
            this.imageElementRef.current!.src = this.IMAGE_PATH
            this.targetElement = this.imageElementRef.current!
            this.controller = this.generateController(this.deviceList.videoinput as MediaDeviceInfo[])
            this.setState({})
            this.predict()
        })
    }

    private setup = (managers: ImageAnalyzerModelManager[], configs: any) => {
        const managerPromises = []
        for(let i=0; i<managers.length; i++){
            const managerPromise = managers[i].init(Object.assign({}, configs[i]))
            managerPromises.push(managerPromise)
        }
        const devicePromise = getDeviceLists()

        Promise.all([devicePromise, ...managerPromises ]).then(res => {
            console.log(res)
            this.deviceList = res[0]
            this.adjustCanvaSize(this.imageElementRef.current!)
            this.imageElementRef.current!.src = this.IMAGE_PATH
            this.targetElement = this.imageElementRef.current!
            this.controller = this.generateController(this.deviceList.videoinput as MediaDeviceInfo[])
            this.setState({})
            this.predict()
        })
    }

    componentDidMount() {
//        this.setup(this.manager!, this.config)
        this.setup(this.managers!, this.configs)
    }

    predict = () => {
        
        this.originalCanvas.current!.getContext("2d")!.drawImage(this.targetElement!, 0, 0, this.originalCanvas.current!.width, this.originalCanvas.current!.height)
        this.pfmRef.current!.start()

        const managerPromises = []
        for(let i=0; i<this.managers!.length;i++){
            const p = this.managers![i].predict(this.originalCanvas.current!, this.paramss![i])
            managerPromises.push(p)
        }


        Promise.all(managerPromises).then((predictions)=>{
            this.handleResult(predictions)
            this.pfmRef.current!.end()

            if(this.originalCanvasSizeChange){
                this.originalCanvasSizeChanged(this.originalCanvas.current!.width, this.originalCanvas.current!.height)
                this.originalCanvasSizeChange = false
            }
        
            if(this.reloadRequired === true){
                const managerPromises = []
                for(let i=0; i<this.managers!.length;i++){
                    const p = this.managers![i].init(Object.assign({}, this.configs![i]))
                    managerPromises.push(p)
                }

                Promise.all(managerPromises).then(()=>{
                    console.log("manager all reloaded")
                    this.reloadRequired=false
                    setTimeout(() => {
                        this.predict()
                    }, 0)
                })
            }else{
                setTimeout(() => {
                    this.predict()
                }, 0)
            }
        }).catch(x => {
            console.log("Exception:", x)
        })
    }
    render() {
        console.log("rendor")
        return (
            <div>
                <div>
                    <img ref={this.imageElementRef} style={{ display: "none" }} alt="" crossOrigin="anonymous" />
                    <video ref={this.videoElementRef} style={{ display: "none" }} />
                    <canvas ref={this.originalCanvas} />
                    <canvas ref={this.resultCanvasRef} />
                </div>
                <div>
                    フリー素材ぱくたそ（www.pakutaso.com）model by 河村友歌
        </div>
                {this.controller}
                <PerformanceCanvas ref={this.pfmRef} />
            </div>
        )

    }
}


/////////////////////////
//// getDeviceList
/////////////////////////

export const getDeviceLists = async () => {
    const list = await navigator.mediaDevices.enumerateDevices()

    const audioInputDevices = list.filter((x: InputDeviceInfo | MediaDeviceInfo) => {
        return x.kind === "audioinput"
    })
    const videoInputDevices = list.filter((x: InputDeviceInfo | MediaDeviceInfo) => {
        return x.kind === "videoinput"
    })
    const audioOutputDevices = list.filter((x: InputDeviceInfo | MediaDeviceInfo) => {
        return x.kind === "audiooutput"
    })
    const videoInputResolutions = [
        { deviceId: "360p", groupId: "360p", kind: "videoinputres", label: "360p" },
        { deviceId: "540p", groupId: "540p", kind: "videoinputres", label: "540p" },
        { deviceId: "720p", groupId: "720p", kind: "videoinputres", label: "720p" },
    ]
    return {
        audioinput: audioInputDevices,
        videoinput: videoInputDevices,
        audiooutput: audioOutputDevices,
        videoinputres: videoInputResolutions,
    }
}


///////////////////////////
/// simple performance view
////////////////////////////

interface PerformanceScore {
    processingTimes: number[]
    processingTurnTimes: number[]
    maxLength: number
    startTime: number
    endTime: number

}
class PerformanceCanvas extends React.Component {
    performanceCanvasRef = React.createRef<HTMLCanvasElement>()

    private pfm: PerformanceScore = {
        processingTimes: [],
        processingTurnTimes: [],
        maxLength: 50,
        startTime: performance.now(),
        endTime: performance.now(),
    }


    start = () => {
        this.pfm.startTime = performance.now()
    }
    end = () => {
        const previousEndTime = this.pfm.endTime
        this.pfm.endTime = performance.now()

        const predictTime = this.pfm.endTime - this.pfm.startTime
        const turnTime = this.pfm.endTime - previousEndTime

        if (this.pfm.processingTimes.length >= this.pfm.maxLength) {
            this.pfm.processingTimes.shift()
            this.pfm.processingTurnTimes.shift()
        }
        this.pfm.processingTimes.push(predictTime)
        this.pfm.processingTurnTimes.push(turnTime)

        //const averageProcessingTime = this.pfm.processingTimes.reduce((p, c) => { return p + c }) / this.pfm.processingTimes.length
        const averageProcessingTurnTime = this.pfm.processingTurnTimes.reduce((p, c) => { return p + c }) / this.pfm.processingTimes.length
        //const averageProcessingTimeText = "AVR(ms):" + ("" + averageProcessingTime).substr(0, 4) + "[" + this.pfm.processingTimes.length + "]"
        const averageProcessingTurnTimeText = "AVR(ms):" + ("" + averageProcessingTurnTime).substr(0, 4) + "[n=" + this.pfm.processingTimes.length + "]"
        const fps = this.pfm.processingTimes.length / (this.pfm.processingTurnTimes.reduce((p, c) => { return p + c }) / 1000)
        const fpsText = "FPS:" + ("" + fps).substr(0, 4) + "[n=" + this.pfm.processingTimes.length + "]"

        const ctx = this.performanceCanvasRef.current!.getContext("2d")!
        ctx.clearRect(0, 0, this.performanceCanvasRef.current!.width, this.performanceCanvasRef.current!.height)
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.font="15px Arial";
        ctx.fillText(fpsText, 10, 20)
        ctx.fillText(averageProcessingTurnTimeText, 10, 35)
    }

    render() {
        return (
            <div style={{ position: "absolute", top: "20px", left: "3px" }}>
                <canvas ref={this.performanceCanvasRef} height="120px" width="500px" />
            </div>
        )
    }
}
///////////////////////////////////////////////////
/// Simple Controller UI
///////////////////////////////////////////////////

export interface ControllerUIProp {
    title: string
    currentIndexOrValue: number
    values?: (number | string)[]
    displayLabels?: string[]
    fileValue?: string[]
    windowValue?: string[]
    range?: number[]
    callback: (value: string | number | MediaStream) => void
    fileCallback?: (type:string, path:string) => void
}

interface IControllerUI {
    controllerUIProps: ControllerUIProp[]
}

class ControllerUI extends React.Component<IControllerUI, IControllerUI>{
    fileInputRef = React.createRef<HTMLInputElement>()
    currentFileChoosingTitle = "" // to be more ellegant!!


    constructor(props: IControllerUI) {
        super(props)
        //console.log("constructor",props)
        this.state = {
            controllerUIProps: props.controllerUIProps
        }
    }

    //  update = (title:string, newLabel:string|null, newValue:string|number|MediaStream|null) =>{
    update = (title: string, indexOrValue: number) => {
        const newProps = this.state.controllerUIProps.map(x => {
            if (x.title === title) {
                x.currentIndexOrValue = indexOrValue
                if (x.values) {  // for dropdown
                    const selectedValue = x.values[x.currentIndexOrValue]
                    if (x.fileValue?.some(f => f === selectedValue)) {
                        // File
                        this.currentFileChoosingTitle = x.title
                        this.fileInputRef.current!.click()
                    } else if (x.windowValue?.some(w => w === selectedValue)) {
                        // Window
                        //@ts-ignore
                        window.navigator.mediaDevices.getDisplayMedia({ video: true }).then(media => {
                            x.callback(media)
                        })
                    } else {
                        // camera
                        x.callback(selectedValue)
                    }
                } else if (x.range) {
                    x.currentIndexOrValue = indexOrValue
                    x.callback(x.currentIndexOrValue)
                }
            }
            return x
        })
        this.setState({ controllerUIProps: newProps })
//        console.log(title, indexOrValue)
    }

    selectFile = (title: string, fileType:string, path: string) => {
        const x = this.state.controllerUIProps.find(x => x.title === title)
        if(x) x.fileCallback!(fileType, path)
    }


    getCurrentValue = (title: string):string|number => {
        const x = this.state.controllerUIProps.find(x => x.title === title)
        if(x){
            if(x.displayLabels){
                return x.displayLabels[x.currentIndexOrValue]
            }else if(x.values){
                return x.values![x.currentIndexOrValue]
            }else{
                return x!.currentIndexOrValue!
            }
        }
        return ""

    }

    render() {
        const comps = this.state.controllerUIProps.map((x: ControllerUIProp) => {
            if (x.values) {
                return this.dropdown(x)
            } else if (x.range) {
                return this.slider(x)
            }else{
                return this.button(x)
            }
        })

        return (
            <div style={{ position: "absolute", top: "20px", right: "20px", border: "2px solid #000000" }}>
                {comps}
                <input type="file" hidden ref={this.fileInputRef} onChange={(e: any) => {
                    const path = URL.createObjectURL(e.target.files[0]);
                    const fileType = e.target.files[0].type
                    this.selectFile(this.currentFileChoosingTitle, fileType, path)
                }} />
            </div>
        )
    }

    dropdown = (x: ControllerUIProp) => {
        const title = x.title
        const values = x.values!             // selection(value to be used for processing)
        const displayLabels = x.displayLabels!      // selection(label to be used for display)
        const currentIndex = x.currentIndexOrValue
        let displayLabel = displayLabels ? displayLabels[currentIndex] : values[currentIndex]

        return (
            <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
                <span>
                    {title}
                </span>
                <span style={{ paddingLeft: "15px" }}>
                    <Dropdown text={"" + displayLabel} floating labeled button  >
                        <Dropdown.Menu>
                            <Dropdown.Header content={"" + displayLabel} />
                            <Dropdown.Divider />
                            {values.map((x, i) => <Dropdown.Item text={displayLabels ? displayLabels[i] : x} onClick={() => {
                                this.update(title, i)
                            }} />)}
                        </Dropdown.Menu>
                    </Dropdown>
                </span>
            </div>
        )
    }

    slider = (x: ControllerUIProp) => {
        const title = x.title
        const currentValue = x.currentIndexOrValue
        const min = x.range![0]
        const max = x.range![1]
        const step = x.range![2]
        return (
            <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
                <span>
                    {title}
                </span>
                <span style={{ paddingLeft: "15px" }}>
                    <input type="range" value={currentValue} min={min} max={max} step={step} onChange={(e) => {
                        this.update(title, parseFloat(e.target.value))
                    }}></input>
                </span>
                <span style={{ paddingLeft: "5px" }}>
                    {currentValue}
                </span>
            </div>
        )
    }

    button = (x: ControllerUIProp) => {
        const title = x.title
        const onClick = x.callback
        return (
            <div style={{ paddingLeft: "10px", paddingRight: "10px" }}>
                <span>
                    {title}
                </span>
                <span style={{ paddingLeft: "15px" }}>
                    <Button onClick={()=>{onClick("")}}> {title}</Button>
                </span>
            </div>
        )

    }
}



export default DemoBase;
