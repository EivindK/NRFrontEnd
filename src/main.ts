import { View, getDeviceProfile, FlightController, type RenderStateHighlightGroups, createNeutralHighlight } from "@novorender/api";
import { createAPI, type SceneData } from '@novorender/data-js-api'
import { quat, vec3 } from "gl-matrix";



const canvas = document.getElementById("render_canvas") as HTMLCanvasElement;
const btns = document.querySelectorAll("button");
const searchForm = (document.getElementById("searchform") as HTMLInputElement);
const submitButton = document.getElementById("sbmtbtn");

interface SavedCamera {
    pos: vec3;
    rot: quat;
    set: boolean;
}

const cam1Save: SavedCamera = {pos: [0,0,0], rot: [0,0,0,0], set: false};
const cam2Save: SavedCamera = {pos: [0,0,0], rot: [0,0,0,0], set: false};
const cam3Save: SavedCamera = {pos: [0,0,0], rot: [0,0,0,0], set: false};

export async function LoadScene(view: View, controller: AbortController): Promise<void> {
    // Initialize the data API with the Novorender data server service
    const dataApi = createAPI({
        serviceUrl: "https://data.novorender.com/api",
    });

    // Load scene metadata
    // Condos scene ID, but can be changed to any public scene ID
    const sceneData = await dataApi.loadScene("95a89d20dd084d9486e383e131242c4c");
    // Destructure relevant properties into variables
    const { url } = sceneData as SceneData;
    // load the scene using URL gotten from `sceneData`
    const config = await view.loadSceneFromURL(new URL(url));
    const { center, radius } = config.boundingSphere;
    view.activeController.autoFit(center, radius);

    submitButton?.addEventListener('click', () => {
        controller.abort("Starting new search");
        controller = new AbortController();
        LookupEntities(searchForm.value, view, sceneData as SceneData, controller);
    });
}



function SaveCamera(buttonID: number, pos: vec3, rot: quat) {
    switch (buttonID) {
        case (1):
            cam1Save.pos = pos;
            cam1Save.rot = rot;
            cam1Save.set = true;
            break;
        case (2):
            cam2Save.pos = pos;
            cam2Save.rot = rot;
            cam2Save.set = true;
            break;
        case (3):
            cam3Save.pos = pos;
            cam3Save.rot = rot;
            cam3Save.set = true;
            break;
    }
}

function LoadCamera(buttonID: number, view: View) {
    switch(buttonID) {
        case (1):
            if (!cam1Save.set) return;
            view.activeController.moveTo(cam1Save.pos, 1000, cam1Save.rot);
            break;
        case (2):
            if (!cam2Save.set) return;
            view.activeController.moveTo(cam2Save.pos, 1000, cam2Save.rot);
            break;
        case (3):
            if (!cam3Save.set) return;
            view.activeController.moveTo(cam3Save.pos, 1000, cam3Save.rot);
            break;
        default:
            break;
    }
}

async function LookupEntities (entityName: string, view: View, sceneData: SceneData, controller: AbortController) {
    try {
        const { db } = sceneData;
        if (db) {
            
            const signal = controller.signal;

            // Run the searches
            // Fluffy search which will search all properties for words starting with "Roof"
            // "Roo" will still find roofs, but "oof" will not
            const iterator = db.search({ searchPattern: entityName }, signal);

            // In this example we just want to isolate the objects so all we need is the object ID
            const result: number[] = [];

            for await (const object of iterator) {
                result.push(object.id);
            }

            // No results found, push all 
            // (I know this is ugly, but it was the best I could come up with at the time, I'm sorry)
            if (result.length == 0) {
                const allIterator = db.search({ searchPattern: [{property: "123456789", exact: true, exclude: true}] }, signal);

                for await (const object of allIterator) {
                    result.push(object.id);
                }
            }


            // Then we isolate the objects found
            const renderStateHighlightGroups: RenderStateHighlightGroups = {
                defaultAction: "hide",
                groups: [{ action: createNeutralHighlight(), objectIds: result }],
            };

            // Finally, modify the renderState
            view.modifyRenderState({ highlights: renderStateHighlightGroups });
        }
    }   catch (e) {
        console.warn(e);
    }
}

async function main(canvas: HTMLCanvasElement) {
    const gpuTier = 2;
    const devicProfile = getDeviceProfile(gpuTier);

    const imports = await View.downloadImports({ baseUrl: "/novorender/api/"});

    const view = new View(canvas, devicProfile, imports);
    // let sceneData: Awaited<ReturnType<SceneData | SceneLoadFail | any>>;

    view.modifyRenderState({ grid: { enabled: true } });

    await view.switchCameraController("flight");

    const controller = new AbortController();

    LoadScene(view, controller);

    for (var btn of btns) {
        btn.addEventListener('click', function ButtonClick(event) {
            if (event.shiftKey) {
                let  fController: FlightController = view.activeController as FlightController;
                SaveCamera(Number(this.value), fController.position as vec3, fController.rotation as quat);
            } else {
                LoadCamera(Number(this.value), view);
            }
        });
    }

    // submitButton?.addEventListener('click', () => {
    //     console.log("Access through main");
    //     LookupEntities(searchForm.value, view, sceneData as Awaited<Promise<PromiseLike<SceneData>>>, controller)
    // });

    searchForm?.addEventListener('keypress', (event) => { // Prevents some annoying form behaviour that refreshed the page
        if (event.keyCode === 13) {
            event.preventDefault();
          }
    });
    
    await view.run();
    view.dispose();
}

main(canvas);
