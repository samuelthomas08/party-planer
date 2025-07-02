import { useEffect, useState } from 'react';

import './EditFloorPlanEquipment.sass';
import { db } from '../../firebase/firebase';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretRight, faEdit, faFloppyDisk, faTrashCan } from '@fortawesome/free-solid-svg-icons';

import { collection, getDocs, query } from 'firebase/firestore';


const EditFloorPlanEquipment = ({ handleEquipmentDeletion, data, setAbleToCreate, updateEquipmentColor }) => {

    const [color, setColor] = useState(data.data.color);

    const [selectedCategory, setSelectedCategory] = useState(0);

    const [equipmentList, setEquipmentList] = useState([]);
    const [otherEquipmentList, setOtherEquipmentList] = useState([]);

    const [disableSave, setDisableSave] = useState(false);

    const [currentEquipmentSelection, setCurrentEquipmentSelection] = useState(0);
    const [currentOtherEquipmentSelection, setCurrentOtherEquipmentSelection] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const q = query(collection(db, "equipment"));

            const querySnapshot = await getDocs(q);

            const data = querySnapshot.docs.map(el => ({ id: el.id, ...el.data() }));

            const equipment = data.filter(entry => entry.category === 0);
            const otherEquipment = data.filter(entry => entry.category !== 0);

            setEquipmentList(equipment);
            setOtherEquipmentList(otherEquipment);
        };

        fetchData();   
        
        data.showOptions = true;
    }, []);

    const handleEquipmentSelection = () => {
        if(selectedCategory == 0) {
            if(currentEquipmentSelection < equipmentList.length-1) {
                setCurrentEquipmentSelection(currentEquipmentSelection+1);
            } else {
                setCurrentEquipmentSelection(0);
            }
        } else {
            if(currentOtherEquipmentSelection < otherEquipmentList.length-1) {
                setCurrentOtherEquipmentSelection(currentOtherEquipmentSelection+1);
            } else {
                setCurrentOtherEquipmentSelection(0);
            }
        }
    }

    const handleSaveEvent = () => {
        setAbleToCreate(true);
        data.data = {
            selectedEquipment: selectedCategory == 0 ? equipmentList[currentEquipmentSelection].id : otherEquipmentList[currentOtherEquipmentSelection].id,
            category: selectedCategory,
            color: color
        };
        console.log(data);
        data.showOptions = false;
        setDisableSave(true);   
    }

    return (
        <div className="EditFloorPlanEquipment" style={{
            display: data.showOptions ? 'block' : 'none'
        }}>
            <div className="head">
                <h1>Auswahl</h1>
                <FontAwesomeIcon onClick={() => handleEquipmentDeletion(data)} className='delete-selection' icon={faTrashCan} />
            </div>

            <div className="category-selection">
                <p className={selectedCategory == 0 ? 'selected' : (disableSave ? 'disabled' : '')} onClick={() => setSelectedCategory(0)}>Ständer</p>
                <p className={selectedCategory == 1 ? 'selected' : (disableSave ? 'disabled' : '')} onClick={() => setSelectedCategory(1)}>Anderes</p>
            </div>

            <p className='list-length'>{selectedCategory == 0 ? equipmentList.length + ' Einträge' : otherEquipmentList.length + ' Einträge'}</p>

            <div className="equipment-slider">
                <div className="card">
                    {selectedCategory == 0 && equipmentList[currentEquipmentSelection] != null ? 
                        <div className='equipment-item'>
                            <h3>{equipmentList[currentEquipmentSelection].title}</h3>

                            <div className="img-container">
                                <div className="top-bar-add-container">
                                    {equipmentList[currentEquipmentSelection].contents.topBarAdd1 ? <img className='top-bar-add-1' src={equipmentList[currentEquipmentSelection].contents.topBarAdd1} /> : null}
                                    {equipmentList[currentEquipmentSelection].contents.topBarAdd2 ? <img className='top-bar-add-2' src={equipmentList[currentEquipmentSelection].contents.topBarAdd2} /> : null}
                                </div>

                                {equipmentList[currentEquipmentSelection].contents.topBar ? <img className='top-bar' src={equipmentList[currentEquipmentSelection].contents.topBar} /> : null}
                                {equipmentList[currentEquipmentSelection].contents.foot ? <img className='foot' src={equipmentList[currentEquipmentSelection].contents.foot} /> : null}
                                <div className="lights">
                                    <div className="light-container">
                                        {equipmentList[currentEquipmentSelection].contents.light01 ? <img className='light-01' src={equipmentList[currentEquipmentSelection].contents.light01} /> : <div className="light-01"></div> }
                                        {equipmentList[currentEquipmentSelection].contents.light02 ? <img className='light-02' src={equipmentList[currentEquipmentSelection].contents.light02} /> : <div className="light-02"></div> }
                                    </div>
                                    {equipmentList[currentEquipmentSelection].contents.light03 ? <img className='light-03' src={equipmentList[currentEquipmentSelection].contents.light03} /> : <div className="light-03"></div> }
                                    <div className="light-container">
                                        {equipmentList[currentEquipmentSelection].contents.light04 ? <img className='light-04' src={equipmentList[currentEquipmentSelection].contents.light04} /> : <div className="light-04"></div> }
                                        {equipmentList[currentEquipmentSelection].contents.light05 ? <img className='light-05' src={equipmentList[currentEquipmentSelection].contents.light05} /> : <div className="light-05"></div> }
                                    </div>
                                </div>
                            </div>
                        </div> : 
                        (otherEquipmentList[currentOtherEquipmentSelection] != null ? <div className='equipment-item-other-cat'>
                            <h3>{otherEquipmentList[currentOtherEquipmentSelection].title}</h3>

                            <div className="img-container-other-cat">
                                <img className='other-category-img' src={otherEquipmentList[currentOtherEquipmentSelection].contents.img} />
                            </div>
                        </div> : null)
                    }
                </div>
                <div className="slider-icon" style={{display: disableSave ? 'none' : 'block'}}>
                    <FontAwesomeIcon icon={faCaretRight} onClick={handleEquipmentSelection} />
                </div>
            </div>

            <div className='description'>
                <h3>Beschreibung</h3>
                <textarea value={selectedCategory == 0 && equipmentList[currentEquipmentSelection] != null ? 
                    (equipmentList[currentEquipmentSelection].description == '' ? 
                        'Keine Beschreibung enthalten...' : equipmentList[currentEquipmentSelection].description) : 
                    (otherEquipmentList[currentOtherEquipmentSelection] != null ? 
                        (otherEquipmentList[currentOtherEquipmentSelection].description == '' ? 
                            'Keine Beschreibung enthalten...' : otherEquipmentList[currentOtherEquipmentSelection].description) : null)}></textarea>
            </div>

            <div className="color-selection">
                <label htmlFor='color'>Farbe</label>
                <div className="color-select-container">
                    <input readOnly={disableSave ? true : false} onInput={e => {
                        setColor(e.target.value);
                        data.data.color = color;
                        updateEquipmentColor(data.id, e.target.value);

                        console.log(data);
                    }} type='text' id='color' value={color} />
                    <div className="color-represent" style={{background: color}}></div>
                </div>
            </div>
            
            <button onClick={handleSaveEvent} className={disableSave ? "disable-save" : "btn-save"}><FontAwesomeIcon icon={faFloppyDisk} /> Speichern</button>
            <button onClick={() => setDisableSave(false)} className={!disableSave ? "disable-edit" : "btn-edit"}><FontAwesomeIcon icon={faEdit} /> Bearbeiten</button>
        </div>
    )
}   

export default EditFloorPlanEquipment;