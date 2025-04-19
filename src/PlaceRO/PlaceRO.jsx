import { useEffect, useRef, useState } from 'react';
import './PlaceRO.sass';

import Footer from '../Footer/Footer';
import Header from '../Header/Header';

import { faArrowUpFromBracket, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { uid } from 'uid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import imageCompression from "browser-image-compression";
import { doc, getDoc, query, setDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase/firebase';
import FloorPlanEquipment from './FloorPlanEquipment/FloorPlanEquipment';
import FloorPlanEquipmentModal from './FloorPlanEquipmentModal/FloorPlanEquipmentModal';


const PlaceRO = () => {
    const floorPlanRef = useRef();
    const { id } = useParams();

    const [equipmentContainerLoaded, setEquipmentContainerLoaded] = useState(false);

    const [floorPlan, setFloorPlan] = useState();
    const [imgSrc, setImgSrc] = useState('');
    const [equipmentPlacements, setEquipmentPlacements] = useState();

    const [mobileModalShow, setMobileModalShow] = useState(false);

    useEffect(() => {
        const fetchFloorPlan = async () => {
            const q = query(doc(db, 'places', id));

            const querySnapshot = await getDoc(doc(db, 'places', id));

            let temp = [];

            querySnapshot.data().equipments.map(equipment => {
                equipment.showOptions = false;
                temp.push(equipment);
            });

            setEquipmentPlacements(temp);
            setImgSrc(querySnapshot.data().floorPlanImgSrc);


            setFloorPlan(querySnapshot.data());
        }

        fetchFloorPlan();
    }, []);

    const equipmentClickEvent = (e) => {
        let el;

        let tempPlaces = [...equipmentPlacements];

        tempPlaces.map(equipment => {
            equipment.showOptions = false;
            if(e.target.classList[0] == equipment.id) {
                console.log(equipment);
                equipment.showOptions = true;
            }
        });
    
        setEquipmentPlacements(tempPlaces);
        setMobileModalShow(true);
    }

    return floorPlan ? (
        <div className="PlaceRO">
            <Header pageName={floorPlan.name} />
            
            {!equipmentPlacements.every(({ showOptions }) => !showOptions) ? equipmentPlacements.map(equipment => {
                return <FloorPlanEquipmentModal setMobileModalShow={setMobileModalShow} data={equipment}/>
            }) : null}

            {mobileModalShow ? <div className='blur'></div> : null}

            <main>
                <div className="bottom-container" style={floorPlanRef.current ? {height: floorPlanRef.current.getBoundingClientRect().height} : null}>
                    <div className='layout'>
                        <div>
                            <img ref={floorPlanRef} src={imgSrc} className="floor-plan-img" onLoad={() => setEquipmentContainerLoaded(true)}  />
                            {equipmentContainerLoaded ? <div className="floor-plan-edit-layer" style={{
                                width: `${floorPlanRef.current.getBoundingClientRect().width}px`,
                                height: `${floorPlanRef.current.getBoundingClientRect().height}px`,
                                background: 'transparent',
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 200
                            }}>                    
                                {equipmentPlacements.map(equipment => {
                                    const rect = floorPlanRef.current.getBoundingClientRect();
                                    const absoluteX = equipment.x * rect.width;
                                    const absoluteY = equipment.y * rect.height;

                                    return (
                                        <div
                                            key={equipment.id}
                                            className={`${equipment.id} floor-plan-entry`}
                                            onClick={equipmentClickEvent}
                                            style={{
                                                position: 'absolute',
                                                borderRadius: '100%',
                                                background: equipment.data.color,
                                                left: absoluteX - 24,
                                                top: absoluteY - 24,
                                                zIndex: 120,
                                                cursor: 'pointer',
                                                boxShadow: `0 0 1px 0 ${equipment.data.color} inset, 0 0 1px 0 ${equipment.data.color}`,
                                            }}
                                        ></div>
                                    );
                                })}
                            </div> : null}
                        </div>
                    </div>

                    {equipmentPlacements ? <div className="layout-item-select">
                        <div className='current-selection'>
                            {!equipmentPlacements.every(({ showOptions }) => !showOptions) ? equipmentPlacements.map(equipment => {
                                return <FloorPlanEquipment setMobileModalShow={setMobileModalShow} data={equipment}/>
                            }) : 
                            <div className='no-selection'>
                                <h1>Auswahl</h1>
            
                                <p>Aktuell ist kein Equipment ausgewählt.</p>   
                            </div>}    
                        </div>
                    </div> : null}
                </div>

                
            </main>

            <Footer />
        </div>
    ) : null;
}

export default PlaceRO;