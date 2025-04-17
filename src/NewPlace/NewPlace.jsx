import { useEffect, useRef, useState } from 'react';
import './NewPlace.sass';

import Footer from '../Footer/Footer';
import EditFloorPlanEquipment from './EditFloorPlanEquipment/EditFloorPlanEquipment';
import Header from '../Header/Header';

import { faArrowUpFromBracket, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { uid } from 'uid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import imageCompression from "browser-image-compression";
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/firebase';

const NewPlace = () => {
    const layoutImgRef = useRef();
    const floorPlanRef = useRef();
    const nameRef = useRef();

    const navigate = useNavigate();

    const [imgSrc, setImgSrc] = useState('');
    const [imgName, setImgName] = useState('');
    const [imgBase64, setImgBase64] = useState('');

    const [saveDisabled, setSaveDisabled] = useState(true);
    const [ableToCreate, setAbleToCreate] = useState(true);
    const [uploadFail, setUploadFail] = useState(false); 

    const [xCoord, setXCoord] = useState(0);
    const [yCoord, setYCoord] = useState(0);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const [equipmentPlacements, setEquipmentPlacements] = useState([]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const isCreateNewShortcut = event.ctrlKey || event.metaKey;

            if(isCreateNewShortcut) {
                setIsCtrlPressed(true);
            }
        };

        const handleKeyUp = (event) => {
            if (event.key === 'Control') {
              setIsCtrlPressed(false);
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const equipmentClickEvent = (e) => {
        let el;

        let tempPlaces = [...equipmentPlacements];

        tempPlaces.map(equipment => {
            equipment.showOptions = false;
            if(e.target.classList[0] == equipment.id) {
                console.log(equipment);
                equipment.showOptions = true;
                setXCoord(equipment.x * 100);
                setYCoord(equipment.y * 100);
            }
        });
    
        setEquipmentPlacements(tempPlaces);
    }

    const handleFileUpload = async () => {
        const file = layoutImgRef.current.files[0];

        if(file) {
            if(file.name.split('.').pop() == 'png') {
                setUploadFail(false);
                const reader = new FileReader();

                const options = {
                    maxSizeMB: 100,
                    maxWidthOrHeight: 800,
                    useWebWorker: true
                };
                const compressedImg = await imageCompression(file, options);
                reader.readAsDataURL(file);

                reader.onloadend = () => {
                    setImgSrc(reader.result);
                    setImgName(file.name);
                    setUploadFail(false);
                    setSaveDisabled(false);
                }
            } else {
                setUploadFail(true);
                setSaveDisabled(true);
            }
        } else {
            setUploadFail(true);
        }        
    }

    const handleEquipmentDeletion = (data) => {
        console.log(data);

        setEquipmentPlacements(equipmentPlacements.filter(equipment => equipment !== data));
        setAbleToCreate(true);
    }

    const handleNewEquipmentPlacement = (event) => {
        if (imgSrc !== '' && isCtrlPressed && ableToCreate) {
            const imgElement = floorPlanRef.current;
            const rect = imgElement.getBoundingClientRect();

            // Berechnung der relativen Koordinaten
            const relativeX = (event.clientX - rect.left) / rect.width;
            const relativeY = (event.clientY - rect.top) / rect.height;

            // Sicherstellen, dass die Koordinaten innerhalb des Bildes liegen
            if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
                setXCoord(Math.round(relativeX * 100)); // Optional: Für Anzeige in Prozent
                setYCoord(Math.round(relativeY * 100)); // Optional: Für Anzeige in Prozent
                setAbleToCreate(false);

                // Speichere die relativen Koordinaten
                setEquipmentPlacements(equipmentPlacements => [
                    ...equipmentPlacements,
                    {
                        id: uid(12),
                        x: relativeX, // Speichere relative X-Koordinate
                        y: relativeY, // Speichere relative Y-Koordinate
                        showOptions: false,
                        data: {
                            selectedEquipment: '',
                            category: 0,
                            color: '#5672E4'
                        }
                    }
                ]);
            }
        }
    }

    const saveNewEquipment = () => {
        let dbEntryTitle = nameRef.current.value.toLowerCase();
        dbEntryTitle = dbEntryTitle.replace('ä', 'ae');
        dbEntryTitle = dbEntryTitle.replace('ö', 'oe');
        dbEntryTitle = dbEntryTitle.replace('ü', 'ue');
        dbEntryTitle = dbEntryTitle.replace(' ', '_');
        const nameId = dbEntryTitle + uid(12);

        const equipment = {
            equipments: equipmentPlacements,
            floorPlanImgSrc: imgSrc,
            floorPlanImgName: imgName,
            name: nameRef.current.value,
            nameId: nameId
        }

        console.log(equipment);

        setDoc(doc(db, 'places', nameId), equipment).then(navigate('/'));
    }

    return (
        <div className="NewPlace">
            <Header pageName={<input ref={nameRef} className='new-place-name' placeholder="Party-Ort" />} />

            <div className="information-for-selected">
                <div className="left">
                    {imgSrc != '' ? <div className="box">
                        <div className="row">
                            <p className='val'>Bild</p>
                        </div>
                        <div className="row">
                            <div className="row-container">
                                <p>Grundriss</p>
                                <p className='val'>{imgName.slice(0, 30)}{imgName.length > 30 ? '...' : null}</p>
                            </div>
                        </div>
                    </div> : null}

                    <div className="box">
                        <div className="row">
                            <p className='val'>Koordinaten (im Grundriss)</p>
                        </div>
                        <div className="row">
                            <div className="row-container">
                                <p>x</p>
                                <p className='val'>{Math.round(xCoord)}</p>
                            </div>
                            <div className="row-container">
                                <p>y</p>
                                <p className='val'>{Math.round(yCoord)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {imgSrc != '' ? <div className="box">
                    <div className="row"><p className="val">Fertig?</p></div>
                    <button onClick={saveNewEquipment} className="save-floor-plan"><FontAwesomeIcon icon={faFloppyDisk} />  Speichern</button>
                </div> : null}
            </div>

            <div className="bottom-container">
                <div className='layout'>
                    {imgSrc == '' ? <div className="img-upload">
                        <label htmlFor="img-upload"><FontAwesomeIcon icon={faArrowUpFromBracket} /><p>Bild einfügen</p></label>
                        {uploadFail ? <p className='upload-fail-text'>Die hochgeladene Datei hat keinen unterstützen Dateitypen (.png)</p> : null}
                        <input ref={layoutImgRef} onChange={handleFileUpload} type="file" name="" id="img-upload" />
                    </div> : <div>   
                        <img ref={floorPlanRef} src={imgSrc} className="floor-plan-img"  />
                        <div onClick={handleNewEquipmentPlacement} className={isCtrlPressed ? "floor-plan-edit-layer creation-mode" : "floor-plan-edit-layer"} style={{
                            width: `${floorPlanRef.current ? floorPlanRef.current.getBoundingClientRect().width : 0}px`,
                            height: `${floorPlanRef.current ? floorPlanRef.current.getBoundingClientRect().height : 100}px`,
                            background: 'transparent',
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 200
                        }}>                    
                            {equipmentPlacements.map(equipment => {
                                const rect = floorPlanRef.current.getBoundingClientRect(); // Aktuelle Größe des Bildes
                                const absoluteX = equipment.x * rect.width; // Berechne absolute X-Koordinate
                                const absoluteY = equipment.y * rect.height; // Berechne absolute Y-Koordinate

                                return (
                                    <div
                                        key={equipment.id}
                                        className={equipment.id}
                                        onClick={equipmentClickEvent}
                                        style={{
                                            position: 'absolute',
                                            height: '3rem',
                                            width: '3rem',
                                            borderRadius: '100%',
                                            background: equipment.data.color,
                                            left: absoluteX - 24, // Zentriere den Kreis
                                            top: absoluteY - 24, // Zentriere den Kreis
                                            zIndex: 120,
                                            cursor: 'pointer',
                                            boxShadow: `0 0 1px 0 ${equipment.data.color} inset, 0 0 1px 0 ${equipment.data.color}`,
                                        }}
                                    ></div>
                                );
                            })}
                        </div>
                    </div>}

                </div>

                <div className="layout-item-select">
                    {imgSrc != '' ? <div>
                        {equipmentPlacements.map(equipment => <EditFloorPlanEquipment handleEquipmentDeletion={handleEquipmentDeletion} data={equipment} setAbleToCreate={setAbleToCreate} />)}    
                    </div> : <div>
                        <h1>Auswahl</h1>

                        <p>Aktuell ist kein Equipment ausgewählt.</p>   
                    </div>}
                </div>
            </div>

            <Footer />
        </div>
    )
}

export default NewPlace;